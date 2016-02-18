package org.gameon.sweep.model;

public class Room {

    public final String roomId;
    
    public Room(String roomId) {
        this.roomId = roomId;
    }

    @Override
    public String toString() {
        return "Room [roomId=" + roomId + "]";
    }

}
