const express=require("express")
const dotenv=require("dotenv").config()
const {Server}=require("socket.io")

const app=express()
app.use((req,res,next)=>{
    res.header('Access-Control-Allow-Origin', '*');
    next();
})
const expressServer=app.listen(process.env.PORT||3500)

const io=new Server(expressServer,{
    cors:{
        origin:"*"
    }
})

class Room{
    constructor(buzzed,members,host){
        this.buzzed=buzzed,
        this.members=members
        this.host=host
    }
}

const RoomState={
    rooms:new Map(),
    addRoom:function(room,host){
        this.rooms.set(room, new Room(new Map(),new Map(),host))
    },
    deleteRoom:function(room){
        this.rooms.delete(room)
    }
}
const mapToArray=(map)=>{
    arr=[]
    map.forEach((val,key,map)=>{
        arr.push({id:key,name:val})
    })
    return arr
}



io.on("connection",socket=>{
    const endGame=(room)=>{
            socket.broadcast.to(room).emit("endGame","Game has ended")
            if(RoomState.rooms.has(room)){
                
                RoomState.rooms.get(room).members.forEach((val,key,map)=>{
                    const sock = io.sockets.sockets.get(key)
                    if(sock)sock.disconnect(room)
                })
                if(RoomState.rooms.get(room).buzzed!==undefined)
                RoomState.rooms.get(room).buzzed.forEach((val,key,map)=>{
                    const sock = io.sockets.sockets.get(key)
                    if(sock)sock.disconnect(room)
                })
                RoomState.rooms.delete(room)
            }
        }
        const update=(room)=>{
            const data={
                members:mapToArray(RoomState.rooms.get(room).members),
                buzzed:mapToArray(RoomState.rooms.get(room).buzzed)
            }
            io.to(room).emit("update",data)
        }
        // //console.log(`${socket.id} ${socket.client.conn.server.clientsCount }`)
        socket.on("joinRoom",({room,id,name})=>{
 
            if(RoomState.rooms.has(room)){
                socket.join(room)
                RoomState.rooms.get(room).members.set(id,name)
                const data={
                    room:room,
                    name:name,
                    members:mapToArray(RoomState.rooms.get(room).members),
                    buzzed:mapToArray(RoomState.rooms.get(room).buzzed)
                }
                socket.emit("joinedRoom",data)
                io.to(room).emit("newJoin",data)
            }
            else socket.emit("alert",`Room not found`)
        })

        socket.on("hostRoom",(user)=>{
            if(!RoomState.rooms.has(user.room)){
                socket.join(user.room)
                RoomState.addRoom(user.room,user.id)
                socket.emit("hosting",user)
            }
            else socket.emit("alert",`Room already exists`)
        })
        socket.on("buzzRoom",({id,room})=>{
            //console.log(`Buzz:${id}${room}`)
            const name=RoomState.rooms.get(room).members.get(id)
            RoomState.rooms.get(room).buzzed.set(id,name)
            RoomState.rooms.get(room).members.delete(id)
            update(room)
        })
        socket.on("clearBuzz",(room)=>{
            //console.log(room)
            RoomState.rooms.get(room).buzzed.forEach((val,key,map)=>{
                //console.log(val)
                RoomState.rooms.get(room).members.set(key,val)
            })
            RoomState.rooms.get(room).buzzed.clear()

            const members=mapToArray(RoomState.rooms.get(room).members)
            //console.log(members)

            io.to(room).emit("clear",members)
        })
        socket.on("endGame",(room)=>{
            endGame(room)
        })
        socket.on("kick",({id,room,op})=>{
            const sock=io.sockets.sockets.get(id)
            if(sock){
                if(op)io.to(id).emit("endGame","You have been kicked")
                sock.disconnect()
            } 
            if(RoomState.rooms.get(room)){
                if(RoomState.rooms.get(room).buzzed.has(id))RoomState.rooms.get(room).buzzed.delete(id)
                if(RoomState.rooms.get(room).members.has(id))RoomState.rooms.get(room).members.delete(id)
                update(room)    
            }
        })
        socket.on("leave",({name,room})=>{
            if(RoomState.rooms.get(room))io.to(RoomState.rooms.get(room).host).emit("alert",`${name} has left the game`)
        })
        socket.on("lock",(room)=>{

            io.to(room).emit("lock")
        })
        

})



