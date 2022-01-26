var gmaps = google.maps;
var gspherical = gmaps.geometry.spherical;

var radius = 6378137; // google maps earth radius, in meters
var circumference = 2 * Math.PI * radius;

var manhattan = new gmaps.LatLng(40.72328050717967, -73.98846042169191);
var theta = 28.8; // 1st ave heading in degrees
var nAves = 160000;
var nStreets = 254000;

var kRoad = 1/8; // affects distance between displayed roads

var antipode = new gmaps.LatLng(-manhattan.lat(), manhattan.lng() + 180);
var northPole = gspherical.computeOffset(manhattan, circumference / 4, theta);
var southPole = gspherical.computeOffset(manhattan, circumference / 4, theta + 180);
var lgAves = Math.ceil(Math.log(nAves) / Math.LN2);
var lgStreets = Math.ceil(Math.log(nStreets) / Math.LN2);
var nAves2 = 1 << lgAves;
var nStreets2 = 1 << lgStreets;

var waterBlue = '#a5bfdd';
var streetYellow = '#fffa8a';
var signGreen = '#2c7669';


function getAveOrigin(i) {
    // at equator, nAves should go a distance of `circumference`:
    return gspherical.computeOffset(manhattan, i * circumference / nAves, theta - 90);
}

function getAveLine(i, extra) {
    return new gmaps.Polyline($.extend({
        path: [southPole, getAveOrigin(i), northPole],
        geodesic: true,
        clickable: false,
        strokeColor: waterBlue,
        strokeOpacity: 1,
        strokeWeight: 2,
    }, extra));
}

function getStreetRadius(i) {
    // returns radius from south pole.
    // lowest street (-nStreets/2) is at south pole with 0 radius,
    // and 0th street is at equator, circumference/4 from south pole:
    return i*circumference/2/nStreets + circumference/4;
}

function getStreetCircle(i, extra) {
    return new gmaps.Circle($.extend({
        center: southPole,
        radius: getStreetRadius(i),
        clickable: false,
        strokeColor: waterBlue,
        strokeOpacity: 1,
        strokeWeight: 1,
        fillOpacity: 0,
    }, extra));
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
    for(var step = nAves / 2; step >= 1/4; step /= 2) {
        if (gspherical.computeDistanceBetween(getAveOrigin(ave - 1), pos)
            < gspherical.computeDistanceBetween(getAveOrigin(ave + 1), pos))
            ave -= step;
        else
            ave += step;
    }

    return {street: Math.round(street) % nStreets,
            ave: Math.round(ave) % nAves};
}

function getOrdinal(n, useSuffix) {
    if (useSuffix) {
        var suffix = 'th';
        var tens = n % 100;
        if (tens <= 3 || tens >= 21) {
            var ones = n % 10;
            if (ones == 1) suffix = 'st';
            if (ones == 2) suffix = 'nd';
            if (ones == 3) suffix = 'rd';
        }
    }
    n += '';

    // comma-delimit thousands:
    var pat = /(\d+)(\d{3})/;
    while (pat.test(n))
        n = n.replace(pat, '$1,$2');

    if (useSuffix) n += suffix;
    return n;
}

function getStreetString(street, useSuffix) {
    if (street >= 0) street += 1;
    var south = street < 0;
    if (south) street = -street;
    return (south ? 'S&nbsp;' : '') + getOrdinal(street, useSuffix)
}

function getAveString(ave, useSuffix) {
    if (ave >= 0) ave += 1;
    var east = ave < 0;
    if (east) ave = -ave;
    return (east ? 'E&nbsp;' : '') + getOrdinal(ave, useSuffix);
}

function getIntersectionString(pos) {
    return getStreetString(pos.street, true) + ' Street and '
        + getAveString(pos.ave, true) + ' Avenue';
}

var oldHash;
function updateHash(pos, zoom) {
    var street = pos.street, south = "";
    if (street < 0) { street = -street; south = "S"; }
    else street += 1;
    var ave = pos.ave, east = "";
    if (ave < 0) { ave = -ave; east = "E"; }
    else ave += 1;
    location.hash = oldHash = "#" + south + street + ".St." + east + ave + ".Ave/" + zoom;
}

function parseHash() {
    if (location.hash == oldHash) return;
    oldHash = location.hash;
    var groups = /#(S?)\W*(\d+)\W*St\W*(E?)\W*(\d+)\W*Ave\W+(\d+)/i.exec(location.hash);
    if (groups) {
        var zoom = parseInt(groups[5]);
        var street = parseInt(groups[2]);
        var ave = parseInt(groups[4]);
        if (groups[1]) street = -street;
        else street -= 1;
        if (groups[3]) ave = -ave;
        else ave -= 1;

        return {ave: ave, street: street, zoom: zoom};
    }
}


var SignOverlay = function(div, latLng, map) {
    this.div_ = div;
    this.ave_ = div.find('.ave');
    this.street_ = div.find('.street');
    this.latLng_ = latLng;
    this.color_ = this.ave_.css('border-top-color');
    this.setMap(map);
    this.marker_ = null
};
SignOverlay.prototype = new gmaps.OverlayView();
SignOverlay.prototype.setLatLng = function(latLng) {
    var pos = findIntersection(latLng);
    this.ave_.find('.name').html(getAveString(pos.ave));
    this.street_.find('.name').html(getStreetString(pos.street));
    this.latLng_ = latLng;
    this.draw();

    if (!this.marker_)
        this.marker_ = new gmaps.Marker({
            map: this.getMap(),
        });
    this.marker_.setPosition(latLng);
};
SignOverlay.prototype.onAdd = function() {
    this.div_.appendTo(this.getPanes().floatPane);
};
SignOverlay.prototype.draw = function() {
    if (!this.getProjection()) return;
    var pixel = this.getProjection().fromLatLngToDivPixel(this.latLng_);

    var phi = gspherical.computeHeading(this.latLng_, northPole) - 90;
    if (phi < -90) phi += 180;

    var transform = 'rotate(' + phi + 'deg)';
    this.ave_.css({
        top: pixel.y + 5, left: pixel.x + 5,
        '-moz-transform': transform, '-webkit-transform': transform
    });

    phi += 90;
    if (phi > 90) phi -= 180;
    transform = 'rotate(' + phi + 'deg)';
    this.street_.css({
        top: pixel.y + 5, left: pixel.x + 5,
        '-moz-transform': transform, '-webkit-transform': transform
    });
};


var fromHash = !!location.hash;
function global(props) {
    if (!props) props = {};
    props.hash = fromHash;
    props.geolocation = !!navigator.geolocation;
    return props;
}

$(function() {
    map = new gmaps.Map($('#gmap')[0], {
        disableDefaultUI: true,
        zoomControl: true,
        zoom: 2,
        center: manhattan,
        mapTypeId: gmaps.MapTypeId.ROADMAP,
        styles: [
            {
                featureType: 'road',
                stylers: [{visibility: 'off'}]
            }
        ],
    });

    var locationDiv, locationSpinner;
    if(navigator.geolocation) {
        locationDiv = $('#location');
        locationSpinner = $('#location .spinner');
        locationDiv.show();
        map.controls[gmaps.ControlPosition.TOP_LEFT].push($('#location-control')[0]);
    }
    map.controls[gmaps.ControlPosition.TOP_LEFT].push($('#address-control')[0]);

    var userSign;
    function moveUserSign(latLng, noHash) {
        if (!userSign)
            userSign = new SignOverlay($('#user').show(), latLng, map);
        userSign.setLatLng(latLng);
        if (!noHash)
            updateHash(findIntersection(latLng), map.getZoom());
    }

    function hashChange() {
        var hash = parseHash();
        if (hash) {
            var latLng = findLatLng(hash);
            map.setCenter(latLng);
            map.setZoom(hash.zoom);
            moveUserSign(latLng, true);
        }
    }

    var grid = {street: {}, ave: {}};
    var getOverlay = {street: getStreetCircle, ave: getAveLine};
    var nRoads2 = {street: nStreets2, ave: nAves2};
    function showGrid() {
        var zoom = map.getZoom();
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
                else {
                    var extra = {map: map};
                    if (i == 0)
                        $.extend(extra, {strokeColor: streetYellow, zIndex: 5});
                    roads[i] = {overlay: getOverlay[type](i, extra)};
                }
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
        if (!navigator.geolocation) return;
        locationDiv.removeClass().addClass('loading');
        locationSpinner.show();
        navigator.geolocation.getCurrentPosition(function(position) {
            latLng = new gmaps.LatLng(position.coords.latitude, position.coords.longitude);
            map.setCenter(latLng);
            map.setZoom(12);
            moveUserSign(latLng);
            locationSpinner.hide();
            locationDiv.removeClass().addClass('active');
            mpq.track('geolocate success', global());
        }, function() {
            locationSpinner.hide();
            locationDiv.removeClass().addClass('inactive');
            mpq.track('geolocate failure', global());
        });
    }

    var geocoder = new gmaps.Geocoder();
    function geocode() {
        var address = $('#address').val();
        geocoder.geocode({address: address}, function(results, status) {
            if (status == gmaps.GeocoderStatus.OK) {
                map.fitBounds(results[0].geometry.viewport);
                moveUserSign(results[0].geometry.location);
                showGrid();
                if (!locationDiv.hasClass('loading'))
                    // not currently geolocating
                    locationDiv.removeClass().addClass('inactive');
                mpq.track('geocode success', global());
            }
            else
                mpq.track('geocode failure', global());
        });
    }

    gmaps.event.addListener(map, 'zoom_changed', showGrid);
    gmaps.event.addListener(map, 'dragend', showGrid);

    var mouse, mouseAve, mouseAveName, mouseStreet, mouseStreetName, mouseRoads, mouseTimer, mouseRoadsTimer;
    function setupMouse() {
        if (!mouse) {
            mouse = $('#mouse').show();
            mouseAve = mouse.find('.ave');
            mouseAveName = mouseAve.find('.name');
            mouseStreet = mouse.find('.street');
            mouseStreetName = mouseStreet.find('.name');
        }
    }
    gmaps.event.addListener(map, 'mousemove', function(e) {
        if (mouseTimer) return; // don't constantly run
        mouseTimer = setTimeout(function () {
            mouseTimer = null;
            setupMouse();
                var pos = findIntersection(e.latLng);

                if (mouseRoadsTimer)
                    clearTimeout(mouseRoadsTimer);
                mouseRoadsTimer = setTimeout(function() {
                    mouseRoadsTimer = null;
                    if (mouseRoads) {
                        if (mouseRoads.ave == pos.ave && mouseRoads.street == pos.street)
                            return;
                        mouseRoads.aveOverlay.setMap(null);
                        mouseRoads.streetOverlay.setMap(null);
                    }
                    var extra = {map: map, strokeColor: signGreen, zIndex: 10};
                    mouseRoads = {ave: pos.ave, street: pos.street,
                                  aveOverlay: getAveLine(pos.ave, extra),
                                  streetOverlay: getStreetCircle(pos.street, extra)};
                }, 100);

                mouseAveName.html(getAveString(pos.ave));
                mouseStreetName.html(getStreetString(pos.street));

                var phi = gspherical.computeHeading(e.latLng, northPole) - 90;
                if (phi < -90) phi += 180;

                var transform = 'rotate(' + phi + 'deg)';
                mouseAve.css({
                    top: e.pixel.y + 5, left: e.pixel.x + 5,
                    '-moz-transform': transform, '-webkit-transform': transform
                });

                phi += 90;
                if (phi > 90) phi -= 180;
                transform = 'rotate(' + phi + 'deg)';
                mouseStreet.css({
                    top: e.pixel.y + 5, left: e.pixel.x + 5,
                    '-moz-transform': transform, '-webkit-transform': transform
                });
        }, 10);

            e.returnValue = false;
    });

    if (locationDiv) {
        gmaps.event.addListener(map, 'dragstart', function() {
            if (!locationDiv.hasClass('loading'))
                // not currently geolocating
                locationDiv.removeClass().addClass('inactive');
        });
    }

    $(window).bind('hashchange', hashChange);
    $('#location').click(function() {
        mpq.track('geolocate', global());
        geolocate();
    });
    $('#address-form').submit(function() {
        $('#address').blur();
        mpq.track('geocode', global());
        geocode();
        return false;
    });

    mpq.track('view', global());

    if (location.hash)
        hashChange();
    else
        geolocate();
    showGrid();
});
