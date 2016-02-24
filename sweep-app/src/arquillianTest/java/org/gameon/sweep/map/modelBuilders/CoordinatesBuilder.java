package org.gameon.sweep.map.modelBuilders;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;

public class CoordinatesBuilder implements NodeBuilder {

    private CoordinatesBuilder() {

    }

    public static CoordinatesBuilder someCoordinates() {
        return new CoordinatesBuilder();
    }

    @Override
    public JsonNode build() {
        return JsonNodeFactory.instance.objectNode();
    }

}
