require('dotenv').config();
const express=require('express');
const router=express.Router();
const token=require('jsonwebtoken');
const connectionPromise=require('../database & models/databaseConnection');




router.post('/',async(req,res)=>{
    const {Id,Password}=req.body;
    if(!Id || !Password ){
        res.json("message:Please input Your Id/Email And Password")
    }
    
    try{
        const [user]=await connectionPromise.query(`select * from STUDENTS where StudentId=${Id} AND Password='${Password}'`);
        
        
        if(!user[0]){
            res.status(401).json("invalid user credentials")
        }
        else{
            const accessToken=token.sign({"studentId":Id},process.env.ACCESS_TOKEN_SECRET,{expiresIn:'225s'})
            const refreshToken=token.sign({"studentId":Id},process.env.REFRESH_TOKEN_SECRET,{expiresIn:'15d'})
            res.status(200).send({accessToken,refreshToken});
        }
    }
        
    catch{(err)=>{
        res.send(err)
    }}
    
})

module.exports=router;