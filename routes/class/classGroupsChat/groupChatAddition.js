const connectionPromise=require('../../../database & models/databaseConnection')

//this socket will automatically find user past rooms in database and adds him in real time chat mode of those rooms
module.exports=(socket)=>{
    socket.emit('joinRooms',async(socket)=>{
        
        
    })
}