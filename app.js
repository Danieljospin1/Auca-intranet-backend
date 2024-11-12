const express=require('express')
const app=express()
const port= 3000
const bodyParser=require('body-parser')
const login=require('./routes/logIn')
const db=require('./database & models/databaseConnection')
const StudentMarks=require('./routes/home/private/studentMarks')
const studentProfile=require('./routes/studentProfile')
const staffProfile=require('./routes/staffProfile')
const posts=require('./routes/home/public/posts')
const comments=require('./routes/home/public/comments')
const likes=require('./routes/home/public/likes')
const dislikes=require('./routes/home/public/dislikes')
const neutral=require('./routes/home/public/neutral')
const classGroups=require('./routes/class/classGroupsChat/groupChats')
const library=require('./routes/library/library')
const studentProfileHandler=require('./routes/FileHandlers/studentProfiles')
const staffProfileHandler=require('./routes/FileHandlers/staffProfiles')
const postsFileHandler=require('./routes/FileHandlers/postImages')




app.use(bodyParser.json());
app.use('/login',login)
app.use('/student/profile',studentProfile)
app.use('/staff/profile',staffProfile)
app.use('/home/posts',posts)
app.use('/home/posts/comment',comments)
app.use('/home/posts/like',likes)
app.use('/home/posts/dislike',dislikes)
app.use('/home/posts/neutral',neutral)
app.use('/home/studentPerformance',StudentMarks)
app.use('/class/classGroups',classGroups)
app.use('/student/library',library)
app.use('/student/imgProfile',studentProfileHandler)
app.use('/staff/imgProfile',staffProfileHandler)
app.use('/home/posts',postsFileHandler)





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