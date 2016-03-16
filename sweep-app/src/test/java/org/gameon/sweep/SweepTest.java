package org.gameon.sweep;

import org.gameon.sweep.model.Site;
import org.jmock.Expectations;
import org.jmock.auto.Mock;
import org.jmock.integration.junit4.JUnitRuleMockery;
import org.junit.Rule;
import org.junit.Test;

public class SweepTest {

    @Rule
    public JUnitRuleMockery  context = new JUnitRuleMockery();
    @Mock
    private SiteNavigator navigator;
    @Mock
    private RoomCommunicator communicator;
    
    @Test
    public void testVisitRoomAndSayHello() {
        final Site room = new Site("abc");
        context.checking(new Expectations() {{
            allowing(navigator).goToNextSite();
            will(returnValue(room));
            
            atLeast(1).of(communicator).sayHello(with(room));
        }});
        
        Sweep sweep = new Sweep(navigator, communicator);
        sweep.visitNextSite();
    }
    
}
