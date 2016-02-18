package org.gameon.sweep;

import org.gameon.sweep.model.Room;

public class Sweep {

    private final RoomNavigator navigator;
    private final RoomCommunicator communicator;

    public Sweep(RoomNavigator navigator, RoomCommunicator communicator) {
        this.navigator = navigator;
        this.communicator = communicator;
    }

    public void visitNextRoom() {
        Room nextRoom = navigator.goToNextRoom();
        communicator.sayHello(nextRoom);
    }

}
