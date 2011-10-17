var gmaps = google.maps;
var gspherical = gmaps.geometry.spherical;

var radius = 6378137; // google maps earth radius, in meters
var circumference = 2 * Math.PI * radius;

var manhattan = new gmaps.LatLng(40.72328050717967, -73.98846042169191);
var theta = 28.8; // 1st ave heading in degrees
var nAves = 160000;
var nStreets = 254000;

var kRoad = 0.5; // affects number of displayed roads

var antipode = new gmaps.LatLng(-manhattan.lat(), manhattan.lng() + 180);
var northPole = gspherical.computeOffset(manhattan, circumference / 4, theta);
var southPole = gspherical.computeOffset(manhattan, circumference / 4, theta + 180);
var lgAves = Math.ceil(Math.log(nAves) / Math.LN2);
var lgStreets = Math.ceil(Math.log(nStreets) / Math.LN2);
var nAves2 = 1 << lgAves;
var nStreets2 = 1 << lgStreets;


function getAveOrigin(i) {
    // at equator, nAves should go a distance of `circumference`:
    return gspherical.computeOffset(manhattan, i * circumference / nAves, theta - 90);
}

function getAveLine(i, map) {
    return new gmaps.Polyline({
	path: [southPole, getAveOrigin(i), northPole],
	geodesic: true,
	//zIndex: nStreets*2,
	clickable: false,
	strokeColor: '#fffa8a',
	strokeOpacity: 0.6,
	strokeWeight: 6,
	map: map,
    });
}

function getStreetRadius(i) {
    // returns radius from south pole.
    // lowest street (-nStreets/2) is at south pole with 0 radius,
    // and 0th street is at equator, circumference/4 from south pole:
    return i*circumference/2/nStreets + circumference/4;
}

function getStreetCircle(i, map) {
    return new gmaps.Circle({
	center: southPole,
	radius: getStreetRadius(i),
	//zIndex: nStreets - i,
	clickable: false,
	strokeColor: '#ffffff',
	strokeOpacity: 0.6,
	strokeWeight: 4,
	fillOpacity: 0,
	map: map,
    });
}

function findLatLng(pos) {
    var ave0 = getAveOrigin(pos.ave);
    var phi = gspherical.computeHeading(ave0, northPole);
    return gspherical.computeOffset(ave0, getStreetRadius(pos.street) - circumference/4, phi);
}

function findIntersection(pos) {
    var d = gspherical.computeDistanceBetween(southPole, pos);
    // inverse of getStreetRadius:
    var street = (d - circumference/4) * nStreets * 2 / circumference;

    // binary search for closest avenue:
    var ave = 0;
    for(var step = nAves / 2; step >= 0.5; step /= 2) {
	if (gspherical.computeDistanceBetween(getAveOrigin(ave - 1), pos)
	    < gspherical.computeDistanceBetween(getAveOrigin(ave + 1), pos))
	    ave -= step;
	else
	    ave += step;
    }

    return {street: Math.round(street),
	    ave: Math.round(ave)};
}

function getOrdinal(n) {
    var suffix = 'th';
    var tens = n % 100;
    if (tens <= 3 || tens >= 21) {
	var ones = n % 10;
	if (ones == 1) suffix = 'st';
	if (ones == 2) suffix = 'nd';
	if (ones == 3) suffix = 'rd';
    }
    n += '';
    // comma-delimit thousands:
    var pat = /(\d+)(\d{3})/;
    while (pat.test(n))
	n = n.replace(pat, '$1,$2');
    return n + suffix;
}

function getIntersectionString(pos, separator) {
    var street = pos.street, ave = pos.ave;
    if (street >= 0) street += 1;
    if (ave >= 0) ave += 1;
    var south = street < 0;
    if (south) street = -street;
    var east = ave < 0;
    if (east) ave = -ave;
    return (south ? 'S ' : '') + getOrdinal(street) + ' Street'
	+ (separator || ' and ')
	+ (east ? 'E ' : '') + getOrdinal(ave) + ' Avenue';
}


$(function() {
    var mapTypeId = 'nycentric';
    var map = new gmaps.Map($('#gmap')[0], {
	disableDefaultUI: true,
	zoomControl: true,
	mapTypeId: mapTypeId,
	zoom: 2,
	center: manhattan,
    });
    map.mapTypes.set(mapTypeId, new gmaps.StyledMapType([
	{
	    featureType: 'road',
	    stylers: [{visibility: 'off'}]
	},
    ]));

    var locationDiv, locationSpinner;
    if(navigator.geolocation) {
	locationDiv = $('#location');
	locationSpinner = $('#location .spinner');
	locationDiv.show();
	map.controls[gmaps.ControlPosition.TOP_LEFT].push($('#location-control')[0]);
    }
    map.controls[gmaps.ControlPosition.TOP_LEFT].push($('#address-control')[0]);

    var infoWindow;
    function getInfoWindow(content, position) {
	if (!infoWindow)
	    infoWindow = new gmaps.InfoWindow({});
	infoWindow.setContent(content);
	infoWindow.setPosition(position || map.getCenter());
	infoWindow.open(map);
    }

    var grid = {street: {}, ave: {}};
    var getOverlay = {street: getStreetCircle, ave: getAveLine};
    var nRoads2 = {street: nStreets2, ave: nAves2};
    function showGrid() {
	var zoom = map.getZoom() + 2;
	var center = findIntersection(map.getCenter());

	for(var type in grid) {
	    var roads = grid[type];
	    // use powers of 2 so that half of streets will remain when zooming:
	    var dRoad = Math.ceil(kRoad * nRoads2[type] / (1 << zoom));
	    var road = Math.round(center[type] / dRoad) * dRoad;

	    // invalidate old roads:
	    for(var i in roads)
		roads[i].clip = true;

	    for(var k = -20; k < 20; k++) {
		var i = road + k*dRoad;
		if (i in roads) // reuse old road
		    roads[i].clip = false;
		else
		    roads[i] = {overlay: getOverlay[type](i, map)};
	    }

	    // remove clipped roads:
	    for(var i in roads) {
		if (roads[i].clip) {
		    roads[i].overlay.setMap(null);
		    delete roads[i];
		}
	    }
	}
    }

    function geolocate() {
	locationDiv.removeClass().addClass('loading');
	locationSpinner.show();
	navigator.geolocation.getCurrentPosition(function(pos) {
	    pos = new gmaps.LatLng(pos.coords.latitude, pos.coords.longitude);
	    var intersection = getIntersectionString(findIntersection(pos));
	    getInfoWindow('You are here.<br/>' + intersection, pos);
	    map.setCenter(pos);
	    map.setZoom(12);
	    locationSpinner.hide();
	    locationDiv.removeClass().addClass('active');
	}, function() {
	    console.log('Geolocation failed.');
	    locationSpinner.hide();
	    locationDiv.removeClass().addClass('inactive');
	});
    }

    var geocoder = new gmaps.Geocoder();
    function geocode() {
	var address = $('#address').val();
	geocoder.geocode({address: address}, function(results, status) {
	    if (status == gmaps.GeocoderStatus.OK) {
		map.setCenter(results[0].geometry.location);
		showGrid();
		if (!locationDiv.hasClass('loading'))
		    // not currently geolocating
		    locationDiv.removeClass().addClass('inactive');
	    }
	    else
		console.log('Geocode failed: ' + status);
	});
    }

    gmaps.event.addListener(map, 'zoom_changed', showGrid);
    gmaps.event.addListener(map, 'dragend', showGrid);
    gmaps.event.addListener(map, 'click', function(e) {
	var intersection = getIntersectionString(findIntersection(e.latLng));
	getInfoWindow(intersection, e.latLng);
	console.log(e.latLng);
    });

    var intersection;
    gmaps.event.addListener(map, 'mousemove', function(e) {
	var phi = gspherical.computeHeading(e.latLng, northPole) - 90;
	if (phi < -90) phi += 180;
	var transform = 'rotate(' + phi + 'deg)';
	$('#intersection').css({
	    top: e.pixel.y + 5, left: e.pixel.x + 5,
	    '-moz-transform': transform, '-webkit-transform': transform
	}).html(getIntersectionString(findIntersection(e.latLng), '<br/>'));
	e.returnValue = false;
    });

    if (locationDiv) {
	gmaps.event.addListener(map, 'dragstart', function() {
	    if (!locationDiv.hasClass('loading'))
		// not currently geolocating
		locationDiv.removeClass().addClass('inactive');
	});
    }

    $('#location').click(geolocate);
    $('#address-form').submit(function(e) {
	geocode();
	return false;
    });

    showGrid();
    geolocate();
});
