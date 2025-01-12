const express=require('express')
const app=express()
const port= 3000
const socketIo=require('socket.io')
const http=require('http')
const socketRoutes=require('./routes/class/classGroupsChat/messagingHandler')
const bodyParser=require('body-parser')
const login=require('./routes/logIn')
const StudentMarks=require('./routes/home/private/studentMarks')
const studentProfile=require('./routes/studentProfile')
const staffProfile=require('./routes/staffProfile')
const posts=require('./routes/home/public/posts')
const comments=require('./routes/home/public/comments')
const classGroups=require('./routes/class/classGroupsChat/groupChats')
const library=require('./routes/library/library')
const studentProfileHandler=require('./routes/FileHandlers/studentProfiles')
const staffProfileHandler=require('./routes/FileHandlers/staffProfiles')
const postsFileHandler=require('./routes/FileHandlers/postImages')
const postReactions=require('./routes/home/public/postReactions')
const liveclasses=require('./routes/class/liveClass/liveClasses')
const LecturerCourseSelection=require('./routes/class/liveClass/searchCources')
const {socketAuthenticate}=require('./Authentication/authentication')


// websockets configuration
const socketServer=http.createServer(app)
const io=socketIo(socketServer)
io.use(socketAuthenticate)//authentication middleware
socketRoutes(io)



app.use(bodyParser.json());
app.use('/login',login)
app.use('/student/profile',studentProfile)
app.use('/staff/profile',staffProfile)
app.use('/home/posts',posts)
app.use('/home/posts/reactions',postReactions)
app.use('/home/posts/comment',comments)
app.use('/home/studentPerformance',StudentMarks)
app.use('/class/classGroups',classGroups)
app.use('/class/liveClass',liveclasses)
app.use('/class/lecturerCourseSelection',LecturerCourseSelection)
app.use('/library',library)
app.use('/student/imgProfile',studentProfileHandler)
app.use('/staff/imgProfile',staffProfileHandler)
app.use('/home/posts',postsFileHandler)






const Start=()=>{
    try{
        socketServer.listen(port,()=>{
          console.log(`server is listerning to ${port} ...`)
      })
 
    }
    catch(err){
       console.log(err)
 }
 };
 Start();