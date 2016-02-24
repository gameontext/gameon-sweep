package org.gameon.sweep.map.modelBuilders;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;

public class RoomBuilder implements NodeBuilder {

    private RoomBuilder() {

    }

    public static RoomBuilder aRoom() {
        return new RoomBuilder();
    }

    @Override
    public JsonNode build() {
        return JsonNodeFactory.instance.objectNode();
    }

}
