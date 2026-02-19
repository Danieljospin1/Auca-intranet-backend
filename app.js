const express = require('express')
const app = express()
const port = process.env.PORT || 3000
const socketIo = require('socket.io')
const http = require('http')
const cors = require('cors')
const socketRoutes = require('./routes/class/classGroupsChat/messagingHandler')
const bodyParser = require('body-parser')
const login = require('./routes/logIn')
const StudentMarks = require('./routes/home/private/studentMarks')
const studentProfile = require('./routes/studentProfile')
const staffProfile = require('./routes/staffProfile')
const posts = require('./routes/home/public/posts')
const comments = require('./routes/home/public/comments')
const classResources = require('./routes/classResources/classResources')
const studentProfileHandler = require('./routes/FileHandlers/studentProfiles')
const staffProfileHandler = require('./routes/FileHandlers/staffProfiles')
const postsFileHandler = require('./routes/FileHandlers/postImages')
const postReactions = require('./routes/home/public/postReactions')
const liveclasses = require('./routes/class/liveClass/liveClasses')
const LecturerCourseSelection = require('./routes/class/liveClass/searchCources')
const { socketAuthenticate } = require('./Authentication/authentication')
const GroupChatAddition = require('./routes/class/classGroupsChat/groupChatAddition')
const classWorks = require('./routes/class/classWorks/classWorks')
const classWorksFileHandler = require('./routes/FileHandlers/classWorksFile')
const notification = require('./routes/notifications/notifications')
const postImgThumbnail = require('./routes/FileHandlers/postThumbnail')
const classResourceFiles = require('./routes/FileHandlers/classResources')
const register = require('./routes/Register')  

require('dotenv').config()

// CREATE HTTP SERVER FIRST
const socketServer = http.createServer(app)

// CONFIGURE SOCKET.IO WITH CORS
const io = socketIo(socketServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type"]
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
})

io.use(socketAuthenticate)
socketRoutes(io)
app.set('io', io)

// ENABLE CORS FOR EXPRESS
app.use(cors({
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
}))

// BODY PARSER
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// HEALTH CHECK ENDPOINT
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Backend is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  })
})

// ROUTES
app.use('/register', register)                                    // ✅ ADDED: lowercase, matches client POST /register
app.use('/login', login)
app.use('/student/profile', studentProfile)
app.use('/staff/profile', staffProfile)
app.use('/home/posts', posts)
app.use('/home/posts/reactions', postReactions)
app.use('/home/posts/comment', comments)
app.use('/home/studentPerformance', StudentMarks)
app.use('/class/liveClass', liveclasses)
app.use('/class/lecturerCourseSelection', LecturerCourseSelection)
app.use('/class/groupChat', GroupChatAddition)
app.use('/class/classWorks', classWorks)
app.use('/class/classWorks', classWorksFileHandler)
app.use('/ClassResources', classResources)
app.use('/ClassResources', classResourceFiles)
app.use('/student/imgProfile', studentProfileHandler)
app.use('/staff/imgProfile', staffProfileHandler)
app.use('/home/posts', postsFileHandler)
app.use('/home/posts', postImgThumbnail)
app.use('/notifications', notification)

// ERROR HANDLING MIDDLEWARE
app.use((err, req, res, next) => {
  console.error('Error:', err)
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  })
})

// START SERVER
const Start = () => {
  try {
    socketServer.listen(port, '0.0.0.0', () => {
      console.log(`Server is listening on port ${port}`)
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
    })
  } catch (err) {
    console.error('Server start error:', err)
  }
}

Start()