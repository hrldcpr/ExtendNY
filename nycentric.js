
var manhattan = new google.maps.LatLng(40.72328050717967, -73.98846042169191);
var antipode = new google.maps.LatLng(-manhattan.lat(), manhattan.lng()+180);
var radius = 6378137; // google maps earth radius, in meters
var circumference = 2*Math.PI*radius;
var theta = 28.8; // 1st ave has a heading of 28.5 degrees:
var northPole = google.maps.geometry.spherical.computeOffset(manhattan, circumference/4, theta);
var southPole = google.maps.geometry.spherical.computeOffset(manhattan, circumference/4, theta+180);
var nAves = 160000;
var nStreets = 127000;

function getAveOrigin(i) {
    return google.maps.geometry.spherical.computeOffset(manhattan, i*circumference/nAves, theta-90);
}

function getAve(i, map) {
    return new google.maps.Polyline({
	path: [southPole, getAveOrigin(i), northPole],
	geodesic: true,
	clickable: false,
	strokeColor: '#fffa8a',
	strokeOpacity: 0.6,
	strokeWeight: 6,
	map: map,
    });
}

function getStreet(i, map) {
    return new google.maps.Circle({
	center: southPole,
	radius: circumference/4 + i*circumference/4/nStreets,
	clickable: false,
	strokeColor: '#ffffff',
	strokeOpacity: 0.6,
	strokeWeight: 4,
	fillOpacity: 0,
	map: map,
    });
}

function initialize() {
    var mapTypeId = 'nycentric';
    var map = new google.maps.Map(document.getElementById('map_canvas'), {
	disableDefaultUI: true,
	zoomControl: true,
	mapTypeId: mapTypeId,
	zoom: 2,
	center: manhattan,
    });
    map.mapTypes.set(mapTypeId, new google.maps.StyledMapType([
	{
	    featureType: 'road',
	    stylers: [{visibility: 'off'}]
	},
    ]));

    function showInfo(content, position) {
	new google.maps.InfoWindow({
	    map: map,
	    position: position || map.getCenter(),
	    content: content,
	});
    }

    // Try HTML5 geolocation
    if(navigator.geolocation) {
	navigator.geolocation.getCurrentPosition(function(pos) {
	    pos = new google.maps.LatLng(pos.coords.latitude,pos.coords.longitude);
	    //showInfo('You are here.', pos);
	    map.setCenter(pos);
	    map.setZoom(12);
	}, function() {
	    console.log('Geolocation failed.');
	    //showInfo('Geolocation failed.<br/>Here is New York City.');
	});
    } else {
	console.log("Browser doesn't support geolocation.");
	//showInfo("Your browser doesn't support geolocation.<br/>Here is New York City.");
    }

    var grid = [];
    google.maps.event.addListener(map, 'bounds_changed', function() {
	var x;
	while(x = grid.pop(0))
	    x.setMap(null);

	var zoom = map.getZoom();
	var dAve = Math.ceil( nAves / (2<<zoom) );
	var dStreet = Math.ceil( nStreets / (2<<zoom) );
	console.log(dAve);
	console.log(dStreet);
	// streets are circles:
	for(var i=0; i<20*dStreet; i+=dStreet)
	    grid.push( getStreet(i, map) );
	// avenues are lines:
	for(var i=0; i<20*dAve; i+=dAve)
	    grid.push( getAve(i, map) );
    });

    google.maps.event.addListener(map, 'click', function(evt) {
	console.log(evt.latLng.toString());
	//showInfo(evt.latLng.toString(), evt.latLng);
    });
}

google.maps.event.addDomListener(window, 'load', initialize);
