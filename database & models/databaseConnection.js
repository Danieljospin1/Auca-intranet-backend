const express=require('express');
const mysql=require('mysql2');

const DBconnection=mysql.createPool({
  host:'localhost',
  user:'root',
  password:'Bisubizo@2001',
  database:'intranet',
  
});
const connectionPromise=DBconnection.promise();
module.exports=connectionPromise;