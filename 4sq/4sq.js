$(function() {
    if (!window.location.hash) {
	var callback = encodeURIComponent(window.location);
	window.location = "https://foursquare.com/oauth2/authenticate?client_id=YORIDF5MNQMUDY3JPSS22RSI0NTRANA4UURVUMDL4FHARQ3C&response_type=token&redirect_uri="+callback;
    }
    else if (window.location.hash.substr(0,14)=="#access_token=") {
	var token = window.location.hash.substr(14);
	$.ajax({url: "https://api.foursquare.com/v2/users/self/checkins?limit=250&oauth_token="+token,
		dataType: "jsonp",
		success: function(data) {
		    var likes = $.map(data.response.checkins.items, function (checkin) {
			if (checkin.venue && checkin.venue.id)
			    return "4sq_"+checkin.venue.id;
		    }).join(",");
		    window.location = "http://api.hunch.com/api/v1/get-recommendations"+window.location.search+"&likes="+likes;
		}});
    }
});
