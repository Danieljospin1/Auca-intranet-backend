const express=require('express')
const app=express()
const port= 3000
const post=require('./routes/posts')
const connectDB=require('./database & models/DBconnection')
const bodyParser=require('body-parser');
const courses=require('./routes/studentMarks')
const postSchema=require('./database & models/PostModel');
const onlineClass=require('./routes/onlineClasses');


app.use(bodyParser.json());
app.use('/course',courses);
app.use('/posts',post);
app.use('/onlineClass',onlineClass);

const Start=()=>{
    try{
       connectDB();
        app.listen(port,()=>{
          console.log(`server is listerning to ${port} ...`)
      })
 
    }
    catch(err){
       console.log(err)
 }
 };
 Start();