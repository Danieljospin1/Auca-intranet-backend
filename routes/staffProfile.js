const express=require('express');
const router=express.Router();
const auth=require('../Authentication/authentication')
const connectionPromise=require('../database & models/databaseConnection');

router.get('/',auth,async(req,res)=>{
    const userID=req.user.staffId;
    try{
        const [staffProfile]=await connectionPromise.query(`select * from staff where Email='${userID}'`);
        res.status(200).send(staffProfile[0]);
    }
    catch{(err)=>{
        res.status(500).json({message:err.message})
    }}
    

})

module.exports=router;