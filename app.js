const express=require('express')
const app=express()
const port= 3000
const bodyParser=require('body-parser');
const login=require('./routes/logIn');
const db=require('./database & models/databaseConnection')
const StudentMarks=require('./routes/studentMarks')
const Profile=require('./routes/profile')
const posts=require('./routes/posts')



app.use(bodyParser.json());
app.use('/login',login)
app.use('/marks',StudentMarks)
app.use('/profile',Profile)
app.use('/home/posts',posts)





const Start=()=>{
    try{
        app.listen(port,()=>{
          console.log(`server is listerning to ${port} ...`)
      })
 
    }
    catch(err){
       console.log(err)
 }
 };
 Start();