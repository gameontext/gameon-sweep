package org.gameon.sweep.map.modelBuilders;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;

public class ExitsBuilder implements NodeBuilder {

    private ExitsBuilder() {

    }

    public static ExitsBuilder someExits() {
        return new ExitsBuilder();
    }

    @Override
    public JsonNode build() {
        return JsonNodeFactory.instance.objectNode();
    }

}
