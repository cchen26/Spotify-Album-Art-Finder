/*
=-=-=-=-=-=-=-=-=-=-=-=-
Album Art Search
=-=-=-=-=-=-=-=-=-=-=-=-
Student ID:23521526
Comment (Required):

=-=-=-=-=-=-=-=-=-=-=-=-
*/

//all the libraries required for this assignment 
const http = require('http');
const https = require('https');
const fs = require('fs');
const url = require('url');
const authentication_cache = './auth/authentication-req.json';
const querystring = require('querystring');
const credentials = require('./auth/credentials.json');
const path = require('path'); //used path to get the image file
const port = 3000;
const server = http.createServer();
let searchResults = ""; //this is used to feed back my search query for generate_page


function create_access_token_cache(authentication) {
	fs.writeFile('./auth/authentication-req.json', JSON.stringify(authentication), function () {//checks if we have a cache from the provided code in the assignment
		console.log('Token Cached');
	});
}

function generate_webpage(imgPathArr, res) {
	
	let h1 = `<div class="header"><h1>Search Results</h1></div>`; //creates a header with text Search Results
	let p1 = `<p>${searchResults}</p>`; //creates a paragraph that uses the result from searchResults
	let img_tags = []; 
	img_tags.push(h1);
	img_tags.push(p1);
	for (let i = 0; i < imgPathArr.length; i++) {
		img_tags[i + 2] = `<img src="${imgPathArr[i]}" />`;
		//it's i+2 because the first 2 elements are occupied by search result header and search query respectively
	}
	res.writeHead(200, {'Content-Type': 'text/html'}); 
	res.end(img_tags.join(""));
}


function create_search_req(authentication, input, resolution) {
	//I took the hard coded rather than using q and type			
	let https_get = https.get(`https://api.spotify.com/v1/search?type=album&q=${input}&access_token=${authentication.access_token}`, (finding) => {
		finding.setEncoding('utf8'); //string
		let body = "";
		finding.on('data', function (chunk) {
			body += chunk;
		});
		finding.on('end', function () {
			let spotifyAlb = JSON.parse(body); //using JSON.parse converts it back to js object 
			console.log(spotifyAlb); 
			let image_counter = 0; //this is the counter for the number of images downloaded
			let imgPathArr = []; //array need to store the string of images

			for (let i = 0; i < spotifyAlb.albums.items.length; i++) {
				//we're iterating through the spotifyAlb array and we are getting every middle image in spotifyAlb.items[i] 
				let imageUrl = spotifyAlb.albums.items[i].images[1].url; 
				let img_path = './album-art/' + path.basename(spotifyAlb.albums.items[i].images[1].url); //use path.base() of the spotify image url to get the unique file name
				imgPathArr.push(img_path); //pushes an string value of an image into the array, imgPathArr.
				console.log(imgPathArr);
				//fs.access checks for caching images
				//if the user have an image with the same filename, it will prioritize that file instead of requesting it  
				fs.access(img_path, function (err) {
					if (err) { //always checks for an error first, if there is an error it means there is a file with the same name
						//downloads the images
						let image_req = https.get(imageUrl, function (image_res) {
							let new_img = fs.createWriteStream(img_path, {'encoding': null});
							image_res.pipe(new_img);
							new_img.on('finish', function () {
								image_counter++; 
								if (image_counter === spotifyAlb.albums.items.length) {
									generate_webpage(imgPathArr, resolution);
								}
							});
						});
						image_req.on('error', function (error) {
							console.log(err);
						});
					} else {
						//also downloads the image but else activates when there no file with the same name
						image_counter++
						if (image_counter === spotifyAlb.albums.items.length) {
							generate_webpage(imgPathArr, resolution);
						}

					}
				});
			}

		});
	});
}

//receiving the artist's name from the user and getting the request from spotify
const received_authentication = function (authentication_res, user_input, auth_sent_time, res) {
	authentication_res.setEncoding('utf8');
	let body = "";
	authentication_res.on('data', function (chunk) {
		body += chunk;
	});
	authentication_res.on('end', function () {
		let spotify_auth = JSON.parse(body);
		console.log(spotify_auth);
		spotify_auth.expiration = auth_sent_time.getTime() + 3600000; //this is when the authentication expires
		create_access_token_cache(spotify_auth, function () {
		});
		create_search_req(spotify_auth, user_input, res, function () {
		});
	});
};

server.on("request", connection_handler);

function connection_handler(req, res) {
	if (req.url === '/') {
		const main = fs.createReadStream('html/main.html'); //handles root
		res.writeHead(200, {'Content-Type': 'text/html'});
		main.pipe(res);
	} else if (req.url === '/favicon.ico') {
		const main = fs.createReadStream('images/favicon.ico'); //handles /favicon.ico
		res.writeHead(200, {'Content-Type': 'image/x-icon'});
		main.pipe(res);
	} else if (req.url === '/images/banner.jpg') { //handles /images/banner.jpg
		const main = fs.createReadStream('images/banner.jpg'); 
		res.writeHead(200, {'Content-Type': 'image/jpeg'});
		main.pipe(res);

	} else if (req.url.startsWith('/album-art')) { //handles /album-art
		let image_stream = fs.createReadStream(`.${req.url}`);
		image_stream.on('error', function (err) {//error handling
			res.writeHead(404, {'Content-Type': 'text/plain'});
			res.write('404 Not Found');
			res.end();
		});
		image_stream.on('ready', function () {
			res.writeHead(200, {'Content-Type': 'image/jpeg'}); //handles jpeg
			image_stream.pipe(res);
		});

	} else if (req.url.startsWith('/search')) {
		let urlObj = url.parse(req.url, true); //we need an urlobj so we can access each of the properties
		let user_input = urlObj.query.artist; //gets the artist's name from the array query
		console.log(user_input); //logs the artist's name onto console
		searchResults = user_input; //used this for generate_webpage
	
		//code provided from the assignment to see if the user has been on the website in the last hours
		let cache_valid = false;
		if (fs.existsSync(authentication_cache)) {
			cached_auth = require(authentication_cache);
			if (new Date(cached_auth.expiration) > Date.now()) {
				cache_valid = true;
			} else {
				console.log('Token Expired');
			}
		}
		//code provided from the assignment to see if the user has been on the website in the last hours
		if (cache_valid) {
			create_search_req(cached_auth, user_input, res);
		} else {
			const token_endpoint = 'https://accounts.spotify.com/api/token';
			const post_data = {grant_type: 'client_credentials'};
			const postDataQuery = querystring.stringify(post_data);
			const auth = Buffer.from(`${credentials.client_id}:${credentials.client_secret}`).toString('base64'); //authentication
			//headers object 
			const headers = {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Authorization': `Basic ${auth}`,
				'Content-Length': postDataQuery.length
			};
			//options object
			const options = {
				method: 'POST',
				headers: headers
			};
			let auth_sent_time = new Date();
			let authentication_req = https.request(token_endpoint, options, function (authentication_res) {
				received_authentication(authentication_res, user_input, auth_sent_time, res);
			});
			authentication_req.on('error', function (e) {
				console.error(e);
			});
			console.log('Requesting Token');
			authentication_req.end(postDataQuery);
		}

	} else {
		//error handling
		res.writeHead(404, {'Content-Type': 'text/plain'});
		res.write('404 Not Found');
		res.end();
	}
}

//turns on the server
server.on("listening", listening_handler);
server.listen(port);

function listening_handler() {
	console.log(`Now Listening on Port ${port}`);
}


