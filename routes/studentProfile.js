const express=require('express');
const router=express.Router();
const auth=require('../Authentication/authentication')
const connectionPromise=require('../database & models/databaseConnection');

router.get('/',auth,async(req,res)=>{
    const userID=req.user.studentId;
    try{
        const [userProfile]=await connectionPromise.query(`select * from students where StudentId=${userID}`);
        res.status(200).send(userProfile[0]);
    }
    catch{(err)=>{
        res.status(500).json({message:err.message})
    }}
    

})
router.patch('/',auth,async(req,res)=>{
    const Phone=req.body.phone;
    const Email=req.body.email;
    const StudentId=req.user.studentId;
    try{
        if(Phone && Email){
            const [userProfile]=await connectionPromise.query(`update students set Phone=${Phone},Email='${Email}' where studentId=${StudentId} `)
            res.send("email and phone updated...")
        }
        if(Phone && !Email){
            const [userProfile]=await connectionPromise.query(`update students set Phone=${Phone} where StudentId=${StudentId}`);
            res.send("phone updated...")
        }
        
        if(!Phone && Email){
            const [userProfile]=await connectionPromise.query(`update students set Email='${Email}' where StudentId=${StudentId}`);
            res.send("updated...")
        


        }
        else{
            res.status(400).json({message:"there is no new email or new phone number you have entered "});
        }
    }
    catch{(err)=>{res.status(500).json({message:err.message})}}
})
module.exports=router;