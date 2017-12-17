'use strict'

var secret = require("./secret.js");


const NOUN_FILE = "noun.csv";
const EPITHET_FILE = "epithet.csv";
const ONOMASTIC_FILE = "onomastic.csv";
// すべてのファイルを示す識別子
const ALL_FILE = "ALL_FILE";

/** Wikipediaからランダムで記事名を取得する。その後、本文を取得するメソッドを呼ぶ */
function getWiki() {
	// https通信で、10個のランダムな記事名を取得する
	let http = require('https');
	const option = {
		protocol: 'https:',
		hostname: 'ja.wikipedia.org',
		path: '/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=10&format=json',
		headers: { 'Api-User-Agent': 'Example/1.0' }
	};

	http.get(option, (res) => {
		var text = "";
		// データをUTF-8に変換し、データチャンクを一つにまとめる
		res.setEncoding('utf8');
		res.on('data', (chunk) => {
			text += chunk;
		}).on('end', () => {
			// JSONデータとみなしてパースし、そこから取得したタイトルでもって、本文を取得するメソッドを呼ぶ
			JSON.parse(text).query.random.forEach(function(item) {
				getSentence(item.title);
			});
		});
  	}).on('error', (e) => {
  		// エラー処理
		console.log(e.message); 
	});	
}

/** 記事名からWikipediaの記事本文を取得し、タグ情報を取り除いた後、解析メソッドを呼ぶ */
function getSentence(title) {
	// https通信で、指定した記事名の本文を取得する
	let http = require('https');
	const option = {
		protocol: 'https:',
		hostname: 'ja.wikipedia.org',
		path: '/w/api.php?action=query&format=json&prop=revisions&titles=' + encodeURIComponent(title) + '&rvprop=content&rvparse',
		headers: { 'Api-User-Agent': 'Example/1.0' }
	};
	http.get(option, (res) => {
		var text = "";
		// データをUTF-8に変換し、データチャンクを一つにまとめる
		res.setEncoding('utf8');
		res.on('data', (chunk) => {
			text += chunk;
		}).on('end', () => {
			// JSONデータとみなしてパースし、そこから取得した本文を使って、タグを取り除くメソッドの後、解析メソッドに回す
			let json = JSON.parse(text);
			for(let item in json.query.pages)
				for(let id in json.query.pages[item].revisions[0])
					analysis(extraction(json.query.pages[item].revisions[0][id]));
		});
  	}).on('error', (e) => {
  		// エラー処理
		console.log(e.message); 
	});	
}

/** 渡されたテキストからタグを取り除いて返す */
function extraction(text) {
	var ret = "";
	var tag = false;
	Array.prototype.forEach.call(text, function(s) {
		// タグが開始したら、フラグを立てる
		if(s == "<")	tag = true;
		// タグの間は本文に含めない
		if(!tag)		ret += s;
		// タグが終わったら、フラグを下す
		if(s == ">")	tag = false;
	});	
	// 無駄な[編集]部分を取り除き、改行は全て「。」とみなして返す。
	return ret.replace(/[編集]/g, "").replace(/[\n\r]/g, "。");
}

/** 渡されたテキストをgoo形態素解析を用いて解析し、名詞と形容詞を取り出して、登録メソッドを呼ぶ */
function analysis(text) {
	// https通信で、指定したテキストの形態素解析データを取得する
	let http = require('https');
	let data = {
		app_id: secret.secretkey,
		sentence: text,
		pos_filter:"名詞|形容詞語幹"
	};

	const options = {
		protocol: 'https:',
		hostname: 'labs.goo.ne.jp',
		path: '/api/morph',
		method: 'POST',
        dataType : 'application/json',
        headers: { 'Content-Type': 'application/json' }
	};

	let req = http.request(options, (res) => {
		let result = "";
		// データをUTF-8に変換し、データチャンクを一つにまとめる
		res.setEncoding('utf8');
		res.on('data', (chunk) => {
			result += chunk;
		}).on('end', () => {
			// リストをもとに登録メソッドを呼ぶ
			/*
			 * word_listは、一文ごとに区切られたリストであり、この一文に対してさらに以下のデータがリスト化されている
			 * data[0] : テキスト
			 * data[1] : 名詞、形容詞などの種別
			 * data[2] : カナ読み
			 */
			register(JSON.parse(result).word_list);
		});

	}).on('error', (e) => {
  		// エラー処理
		console.log('problem with request: ' + e.message);
	});
	req.write(JSON.stringify(data));
	req.end();
}

/** 渡されたリストを元に登録する */
function register(lists) {
	//　リストが空ならば何もしない
	if(lists === undefined)
		return;

	var noun = "";
	var epithet = "";
	// 一文だけ取り出す
	lists.forEach(function(list) {
		// 各データを取り出す
		list.forEach(function(e){
			// 空データ、英数字のみの単語は含まない
			if(e[0] != "" && !e[0].match(/[a-zA-Z0-9]/g))
				// 形容詞か名詞かを判定して追加していく
				if(e[1] == "形容詞語幹")
					epithet += e[0] + "い,";
				else
					noun += e[0] + ",";
		});
	});

	// ファイルに書き込む
	var fs = require('fs');
	// 固有名詞と普通名詞に分割してファイルに書き込む
	separate_onomastic(noun, (noun_csv, onomastic_csv) => {
		fs.appendFileSync(NOUN_FILE, noun_csv);
		fs.appendFileSync(ONOMASTIC_FILE, onomastic_csv);
	});
	fs.appendFileSync(EPITHET_FILE, epithet);
}

/** 渡された名詞リストのCSV表現を固有名詞と普通名詞に分離してコールバックに渡す。 */
function separate_onomastic(noun, callback) {
	// https通信で、取得した名詞リストから固有名詞を取得する
	let http = require('https');
	let data = {
		app_id: secret.secretkey,
		sentence: noun,
	};

	const options = {
		protocol: 'https:',
		hostname: 'labs.goo.ne.jp',
		path: '/api/entity',
		method: 'POST',
        dataType : 'application/json',
        headers: { 'Content-Type': 'application/json' }
	};

	let req = http.request(options, (res) => {
		let result = "";
		// データをUTF-8に変換し、データチャンクを一つにまとめる
		res.setEncoding('utf8');
		res.on('data', (chunk) => {
			result += chunk;
		}).on('end', () => {
			let ne_csv = "";
			let ne_list = JSON.parse(result).ne_list;
			if(ne_list === undefined)
				return;
			// 各データを取り出す
			ne_list.forEach(function(e) {
				// 空データは含まない
				if(e[0] != "") {
					ne_csv += e[0] + ",";
					noun = noun.replace(e[0] + ",", "");
					console.log(ne_csv);
					console.log(noun);
				}
			});
			// コールバック関数を呼ぶ
			callback(noun, ne_csv);
		});

	}).on('error', (e) => {
		// エラー処理
		console.log('problem with request: ' + e.message);
	});
	req.write(JSON.stringify(data));
	req.end();	
}

/** 重複を除去する */
function duplicationDelete() {
	let fs = require('fs');
	let file_list = [ NOUN_FILE, EPITHET_FILE, ONOMASTIC_FILE ];
	// 各ファイルについて重複を除去する
	file_list.forEach(function(file){
		fs.readFile(file, {
			encoding: 'utf-8'
		}, function(err, data) {
			let text = "";
			data.split(",").filter(function(x, i, self) { return self.indexOf(x) == i}).forEach(function(it) {
				text += it + ",";
			});
			var fs = require('fs');
			fs.writeFileSync(file, text);		
		});	

	});
}

/** 指定のCSVファイルをリスト形式に変換して、コールバックに渡す*/
function convertCSVtoList(fileName, callback) {
	let fs = require('fs');
	fs.readFile(fileName, {
		encoding: 'utf-8'
	}, function(err, data) {
		callback(data.split(","));
	});

}

/** 指定ファイル(NOUN_FILEなど)から指定数取得して、コールバックに返す */
function select(fileName, num, callback) {
	// すべてのファイル検査の場合は、select_allを呼ぶ
	if(fileName == ALL_FILE) {
		select_all(num, callback);
		return;
	}
	let number = num;
	convertCSVtoList(fileName, function(list) {
		let ret = [];
		// csvからランダムで取得し、リストに追加する
		for(let i=0; i< number; i++)
			ret.push(list[Math.floor(Math.random() * list.length)]);
		callback(ret);		
	});
}

/** 全てのリストから指定数取得して、コールバックにそのリストを返す */
function select_all(num, callback) {
	var number = num;
	var fs = require('fs');
	fs.readFile(NOUN_FILE, {
		encoding: 'utf-8'
	}, function(err, data) {
		var noun = data;
		fs.readFile(EPITHET_FILE, {
			encoding: 'utf-8'
		}, function(err, data) {
			let list = (data + noun).split(",");
			let ret = [];
			for(let i=0; i< number; i++)
				ret.push(list[Math.floor(Math.random() * list.length)]);
			callback(ret);			
		});

	});
}


exports.NOUN_FILE = NOUN_FILE;
exports.EPITHET_FILE = EPITHET_FILE;
exports.ONOMASTIC_FILE = ONOMASTIC_FILE;
exports.ALL_FILE = ALL_FILE;
exports.ex_create = getWiki;
exports.ex_delete = duplicationDelete;
exports.ex_select = select;
exports.ex_select_all = select_all;