package org.gameon.sweep;

import org.gameon.sweep.model.Site;

public class Sweep {

    private final SiteNavigator navigator;
    private final RoomCommunicator communicator;

    public Sweep(SiteNavigator navigator, RoomCommunicator communicator) {
        this.navigator = navigator;
        this.communicator = communicator;
    }

    public void visitNextSite() {
        Site nextRoom = navigator.goToNextSite();
        communicator.sayHello(nextRoom);
    }

}
