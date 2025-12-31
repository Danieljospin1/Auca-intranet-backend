const express=require('express');
const mysql=require('mysql2');
require('dotenv').config();

const DBconnection=mysql.createPool({
  host:'yamanote.proxy.rlwy.net',
  user:process.env.dbroot,
  password:'PeBvUJyIvdQPTqrbKVijuviMHZHrJmzQ',
  database:'railway',
  port:34899,
  //timezone: '+00:00'
  
});
const connectionPromise=DBconnection.promise();
module.exports=connectionPromise;