function getQueryString() {
    var result = {}, queryString = location.search.substring(1),
			 re = /([^&=]+)=([^&]*)/g, m;
    while (m = re.exec(queryString)) {
	result[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
    }
    return result;
}

console.log(result);
