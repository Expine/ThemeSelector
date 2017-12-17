'use strict';
var myapp = require("./app.js");

// HTTP通信でサーバーを立てる
var http = require('http');
var server = http.createServer();　
server.on('request', function(req, res) {
	// デフォルト形式は全てから取得
	let type = myapp.ALL_FILE;
	let url = req.url;

	// 名詞のみを取得する場合
	if(url.startsWith("/noun")) {
		url = url.substr(5);
		type = myapp.NOUN_FILE;
	}
	// 形容詞のみを取得する場合
	if(url.startsWith("/epithet")) {
		url = url.substr(8);
		type = myapp.EPITHET_FILE;
	}
	// 固有名詞のみを取得する場合
	if(url.startsWith("/onomastic")) {
		url = url.substr(10);
		type = myapp.ONOMASTIC_FILE;
	}

	// URLに数字が渡された場合は、その数だけ取得する
	let num = 3;
	let num_str = url.substr(1);
	if(num_str.match(/[0-9]/g))
		num = Number(num_str);
	// GETメソッドの場合は、ランダムに取得した一般を配置したHTMLを返す
	if(req.method == 'GET') {
		res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});　
		myapp.ex_select(type, num, function(data){
			res.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ThemeSelector</title></head><body>');
			data.forEach(function(it){	
				res.write("<h2>" + it + "</h2>");
			});
			res.write('</body></html>');
			res.end();
		});
	}

	// POSTメソッドの場合は、そのtypeに渡された命令によって処理を変更する	
	if(req.method == 'POST') {
		var post_data = "";
		req.on('data', function(data) {
			post_data = data;
		});
		req.on('end', function() {
			let json = JSON.parse(post_data);
			// create命令は、名詞を拾ってくるように命令する
			if(json.type == 'create')
				myapp.ex_create();
			// delete命令は、重複を消去するように命令する
			else if(json.type == 'delete')
				myapp.ex_delete();
			res.end();
		});
	}
}).listen(7140);