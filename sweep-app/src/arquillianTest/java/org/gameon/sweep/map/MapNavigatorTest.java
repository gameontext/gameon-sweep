package org.gameon.sweep.map;

import static org.gameon.sweep.map.modelBuilders.SiteBuilder.aSite;
import static org.junit.Assert.assertEquals;

import java.io.File;
import java.util.Arrays;

import org.gameon.sweep.SiteNavigator;
import org.gameon.sweep.map.modelBuilders.CoordinatesBuilder;
import org.gameon.sweep.map.modelBuilders.ExitsBuilder;
import org.gameon.sweep.map.modelBuilders.NodeBuilder;
import org.gameon.sweep.map.modelBuilders.RoomBuilder;
import org.gameon.sweep.map.modelBuilders.SiteBuilder;
import org.gameon.sweep.model.Site;
import org.jboss.arquillian.container.test.api.Deployment;
import org.jboss.arquillian.junit.Arquillian;
import org.jboss.shrinkwrap.api.ShrinkWrap;
import org.jboss.shrinkwrap.api.exporter.ZipExporter;
import org.jboss.shrinkwrap.api.spec.WebArchive;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(Arquillian.class)
public class MapNavigatorTest {

    @Deployment()
    public static WebArchive createDeployment() {
        WebArchive archive = ShrinkWrap.create(WebArchive.class, "test.war");
        archive = addClassesUnderTest(archive);
        archive = addFakeMapSites(archive);
        exportArchiveWar(archive);
        return archive;
    }

    private static WebArchive addClassesUnderTest(WebArchive toArchive) {
        toArchive = toArchive.addClasses(MapNavigator.class, Site.class, SiteNavigator.class);
        return addJacksonDependencies(toArchive);
    }

    private static WebArchive addJacksonDependencies(WebArchive toArchive) {
        File[] jacksonDependencies = pathAsFiles(System.getProperty("jackson.path"));
        return toArchive.addAsLibraries(jacksonDependencies);
    }

    private static File[] pathAsFiles(String path) {
        System.out.println(Arrays.asList(path));
        String[] pathElements = path.split(";");
        System.out.println(Arrays.asList(pathElements));
        return Arrays.stream(pathElements).map(File::new).toArray(File[]::new);
    }

    private static WebArchive addFakeMapSites(WebArchive toArchive) {
        toArchive = toArchive.addClasses(FakeMapSites.class);
        return addModelBuilders(toArchive);
    }

    private static WebArchive addModelBuilders(WebArchive toArchive) {
        return toArchive.addClasses(SiteBuilder.class, RoomBuilder.class, ExitsBuilder.class,
                                    CoordinatesBuilder.class, NodeBuilder.class);
    }

    private static void exportArchiveWar(WebArchive archive) {
        archive.as(ZipExporter.class).exportTo(new File("build/test.war"), true);
    }

    @Test
    public void testServletWithName() throws Exception {
        String testId = "expectedTestId";
        FakeMapSites.produceSite(aSite().withId(testId).build());
        MapNavigator navigator = new MapNavigator();
        Site room = navigator.goToNextSite();
        assertEquals(testId, room.siteId);
    }

}
