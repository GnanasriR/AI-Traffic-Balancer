package com.kce.traffic.analytics.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class DirectionUtilTest {

    @Test
    void testNormalizeDirectionValidInputs() {
        assertEquals("NORTH", DirectionUtil.normalizeDirection("North"));
        assertEquals("NORTH", DirectionUtil.normalizeDirection("n"));
        assertEquals("SOUTH", DirectionUtil.normalizeDirection("SOUTH"));
        assertEquals("SOUTH", DirectionUtil.normalizeDirection("s"));
        assertEquals("EAST", DirectionUtil.normalizeDirection("East"));
        assertEquals("EAST", DirectionUtil.normalizeDirection("e"));
        assertEquals("WEST", DirectionUtil.normalizeDirection("WEST"));
        assertEquals("WEST", DirectionUtil.normalizeDirection("w"));
    }

    @Test
    void testNormalizeDirectionInvalidInputs() {
        assertThrows(IllegalArgumentException.class, () -> DirectionUtil.normalizeDirection("UP"));
        assertThrows(IllegalArgumentException.class, () -> DirectionUtil.normalizeDirection(null));
        assertThrows(IllegalArgumentException.class, () -> DirectionUtil.normalizeDirection("  "));
    }

    @Test
    void testShortCodeAndFullName() {
        assertEquals("N", DirectionUtil.toShortCode("NORTH"));
        assertEquals("S", DirectionUtil.toShortCode("South"));
        assertEquals("E", DirectionUtil.toShortCode("e"));
        assertEquals("W", DirectionUtil.toShortCode("west"));

        assertEquals("North Approach", DirectionUtil.toFullName("n"));
        assertEquals("South Approach", DirectionUtil.toFullName("SOUTH"));
        assertEquals("East Approach", DirectionUtil.toFullName("EAST"));
        assertEquals("West Approach", DirectionUtil.toFullName("W"));
    }
}
