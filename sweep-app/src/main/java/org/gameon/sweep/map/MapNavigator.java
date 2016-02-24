package org.gameon.sweep.map;

import java.util.List;

import javax.naming.InitialContext;
import javax.naming.NamingException;
import javax.ws.rs.client.Client;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.core.GenericType;
import javax.ws.rs.core.Response;

import org.gameon.sweep.SiteNavigator;
import org.gameon.sweep.model.Site;

import com.fasterxml.jackson.jaxrs.json.JacksonJsonProvider;

public class MapNavigator implements SiteNavigator {

    public String mapLocation;

    public MapNavigator() throws NamingException {
        mapLocation = (String) InitialContext.doLookup("mapUrl");
    }

    @Override
    public Site goToNextSite() {
        Client client = ClientBuilder.newClient().register(JacksonJsonProvider.class);
        Response response = client.target(mapLocation).request("application/json").get();
        List<Site> sites = response.readEntity(new GenericType<List<Site>>() {});
        return sites.iterator().next();
    }

}
