const express=require('express');
const mysql=require('mysql2');
require('dotenv').config();

const DBconnection=mysql.createPool({
  host:'localhost',
  user:process.env.dbroot,
  password:process.env.dbpassword,
  database:process.env.dbname,
  port:3306,
  timezone: '+00:00'
  
});
const connectionPromise=DBconnection.promise();
module.exports=connectionPromise;