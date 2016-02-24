package org.gameon.sweep.map.modelBuilders;

import static org.gameon.sweep.map.modelBuilders.ExitsBuilder.someExits;
import static org.gameon.sweep.map.modelBuilders.RoomBuilder.aRoom;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * Builder class for a Site, all required fields are set to default values initially.
 */
public class SiteBuilder implements NodeBuilder {

    private final String id;
    private final String rev;
    private final RoomBuilder roomInfo;
    private final ExitsBuilder exits;
    private final String owner;
    private final CoordinatesBuilder coordinates;

    private SiteBuilder(String id, String rev, RoomBuilder info, ExitsBuilder exits, String owner, CoordinatesBuilder coordinates) {
        super();
        this.id = id;
        this.rev = rev;
        this.roomInfo = info;
        this.exits = exits;
        this.owner = owner;
        this.coordinates = coordinates;
    }

    public static SiteBuilder aSite() {
        return new SiteBuilder("defaultId", null, aRoom(), someExits(), "defaultOwner", null);
    }

    public SiteBuilder withId(String id) {
        return new SiteBuilder(id, this.rev, this.roomInfo, this.exits, this.owner, this.coordinates);
    }

    public SiteBuilder withRev(String rev) {
        return new SiteBuilder(this.id, rev, this.roomInfo, this.exits, this.owner, this.coordinates);
    }

    public SiteBuilder with(RoomBuilder room) {
        return new SiteBuilder(this.id, this.rev, room, this.exits, this.owner, this.coordinates);
    }

    public SiteBuilder with(ExitsBuilder exits) {
        return new SiteBuilder(this.id, this.rev, this.roomInfo, exits, this.owner, this.coordinates);
    }

    public SiteBuilder withOwner(String owner) {
        return new SiteBuilder(this.id, this.rev, this.roomInfo, this.exits, owner, this.coordinates);
    }

    public SiteBuilder with(CoordinatesBuilder coordinates) {
        return new SiteBuilder(this.id, this.rev, this.roomInfo, this.exits, this.owner, coordinates);
    }

    @Override
    public JsonNode build() {
        ObjectNode node = JsonNodeFactory.instance.objectNode();
        putIfNotNull("_id", id, node);
        putIfNotNull("_rev", rev, node);
        putIfNotNull("info", roomInfo, node);
        putIfNotNull("exits", exits, node);
        putIfNotNull("owner", owner, node);
        putIfNotNull("coordinates", coordinates, node);
        return node;
    }

    private void putIfNotNull(String key, String value, ObjectNode node) {
        if (value != null) {
            node.put(key, value);
        }
    }

    private void putIfNotNull(String key, NodeBuilder builder, ObjectNode node) {
        if (builder != null) {
            node.put(key, builder.build());
        }
    }

}
