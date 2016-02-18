package org.gameon.sweep;

import org.gameon.sweep.model.Room;
import org.jmock.Expectations;
import org.jmock.auto.Mock;
import org.jmock.integration.junit4.JUnitRuleMockery;
import org.junit.Rule;
import org.junit.Test;

public class SweepTest {

    @Rule
    public JUnitRuleMockery  context = new JUnitRuleMockery();
    @Mock
    private RoomNavigator navigator;
    @Mock
    private RoomCommunicator communicator;
    
    @Test
    public void testVisitRoomAndSayHello() {
        final Room room = new Room("abc");
        context.checking(new Expectations() {{
            allowing(navigator).goToNextRoom();
            will(returnValue(room));
            
            atLeast(1).of(communicator).sayHello(with(room));
        }});
        
        Sweep sweep = new Sweep(navigator, communicator);
        sweep.visitNextRoom();
    }
    
}
