'use strict';
const efrt = require('./src');
// const unpack = require('./builds/efrt-unpack.es6');
// let words = require('./test/data/countries');

var data = {
  bedfordshire: 'England',
  aberdeenshire: 'Scotland',
  buckinghamshire: 'England',
  argyllshire: 'Scotland',
  bambridgeshire: 'England',
  cheshire: 'England',
  true: 'Scotland',
  false: 'Scotland',
  banffshire: 'Scotland',
  prototype: 'constructor'
};
var packd = efrt.pack(data);
console.log(packd, '\n');
var obj = efrt.unpack(packd);
console.log(obj);
