package org.gameon.sweep.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public class Site {

    public final String id;

    @JsonCreator
    public Site(@JsonProperty("_id") String siteId) {
        this.id = siteId;
    }

    @Override
    public String toString() {
        return "Site [id=" + id + "]";
    }

}
