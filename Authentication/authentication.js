const token=require('jsonwebtoken');
require('dotenv').config();
function Authenticate(req,res,next){
    const tokenHeader=req.headers['authorization']
    const tokenReceived=tokenHeader && tokenHeader.split(' ')[1]
    if (tokenReceived == null) return res.status(401).send({ message: 'Unauthorized'})

    
    token.verify(tokenReceived,process.env.ACCESS_TOKEN_SECRET,(Error,user)=>{
        if (Error) return res.status(403).send({ message: 'Failed to authenticate '});
        req.user=user;
        next();
    })
}

module.exports=Authenticate;