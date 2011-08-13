var map;
var mapTypeId = 'nycentric';

function initialize() {
  map = new google.maps.Map(document.getElementById('map_canvas'), {
    zoom: 12,
    disableDefaultUI: true,
    zoomControl: true,
    mapTypeId: mapTypeId,
  });
	map.mapTypes.set(mapTypeId, new google.maps.StyledMapType([
	  {
	    featureType: "road",
	    stylers: [{visibility: "off"}]
	  },
	]));

  // Try HTML5 geolocation
  if(navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      var pos = new google.maps.LatLng(position.coords.latitude,
                                       position.coords.longitude);

      var infowindow = new google.maps.InfoWindow({
        map: map,
        position: pos,
        content: 'Location found using HTML5.'
      });

      map.setCenter(pos);
    }, function() {
      handleNoGeolocation(true);
    });
  } else {
    // Browser doesn't support Geolocation
    handleNoGeolocation(false);
  }

  function drawLine(path, geodesic) {
	  return new google.maps.Polyline({
	    path: path,
      clickable: false,
      geodesic: geodesic || false,
	    //strokeColor: "#000000",
	    strokeOpacity: 0.5,
	    strokeWeight: 1,
      map: map,
    });
  }

  function drawCircle(center, radius, stroke, fill) {
	  return new google.maps.Circle({
      clickable: false,
	    strokeColor: stroke || "#FF0000",
	    strokeOpacity: 0.5,
	    strokeWeight: 1,
	    fillColor: fill || "#FF0000",
	    fillOpacity: fill===false ? 0 : 0.5,
	    center: center,
	    radius: radius,
	    map: map,
    });
  }

  var manhattan = new google.maps.LatLng(40.72250297044599, -73.98848389102079);
  var antipode = new google.maps.LatLng(-manhattan.lat(), manhattan.lng()+180);
  var radius = 6378137; // google maps earth radius, in meters
  var circumference = 2*Math.PI*radius;
  var theta = 28.5; // 1st ave has a heading of 28.5 degrees:
  var northPole = google.maps.geometry.spherical.computeOffset(manhattan, circumference/4, theta);
  var southPole = google.maps.geometry.spherical.computeOffset(manhattan, -circumference/4, theta);

  // avenues are lines:
  for(var i=-50; i<50; i++) {
    var ave = google.maps.geometry.spherical.computeOffset(manhattan, i*circumference/100, theta-90);
    drawLine([ave, northPole], true);
    drawLine([ave, southPole], true);
  }
  // streets are circles:
  for(var i=1; i<100; i++) {
    drawCircle(northPole, i*circumference/200, "#000000", false);
  }

  var oldLine;
  google.maps.event.addListener(map, 'bounds_changed', function() {
    var bounds = map.getBounds();
    //var line = drawLine([bounds.getNorthEast(),bounds.getSouthWest()]);
    //if (oldLine) oldLine.setMap(null);
    //oldLine = line;
  });

  google.maps.event.addListener(map, 'click', function(evt) {
    console.log(evt.latLng.toString());
  });
}

function handleNoGeolocation(errorFlag) {
  if (errorFlag) {
    var content = 'Error: The Geolocation service failed.';
  } else {
    var content = 'Error: Your browser doesn\'t support geolocation.';
  }

  var options = {
    map: map,
    position: new google.maps.LatLng(60, 105),
    content: content
  };

  var infowindow = new google.maps.InfoWindow(options);
  map.setCenter(options.position);
}

google.maps.event.addDomListener(window, 'load', initialize);
