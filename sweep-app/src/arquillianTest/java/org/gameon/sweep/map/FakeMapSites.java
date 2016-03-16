package org.gameon.sweep.map;

import java.util.ArrayList;
import java.util.List;

import javax.ws.rs.ApplicationPath;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Application;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import com.fasterxml.jackson.databind.JsonNode;

@ApplicationPath("/fakeMap")
@Path("/")
public class FakeMapSites extends Application {

    private static List<JsonNode> sites = new ArrayList<>();

    public static void produce(JsonNode site) {
        sites.clear();
        sites.add(site);
    }

    @GET
    @Path("/")
    @Produces(MediaType.APPLICATION_JSON)
    public Response listAll(@QueryParam("owner") String owner,
                            @QueryParam("name") String name) {
        System.out.println("Fake map is returning: "
                           + sites.toString());
        return Response.ok().entity(sites.toString()).build();
    }

}
