package com.kce.traffic.user.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;

import javax.crypto.SecretKey;
import java.util.Date;

/**
 * Builds tokens by hand (valid, expired, wrong-signature, tampered) for JWT tests -
 * independent of JwtUtils so the tests aren't just re-testing the class under test.
 */
public final class TestJwtSupport {

    // Must match application-test.yml's app.jwt.secret
    public static final String TEST_SECRET = "dGVzdC1vbmx5LXNlY3JldC1rZXktMzJ6LWJ5dGVzLW1pbmltdW0tc2VjdXJl";
    private static final String WRONG_SECRET = "d3Jvbmctc2VjcmV0LWtleS0zMnotYnl0ZXMtbWluaW11bS1zZWN1cmUtdGVzdA==";

    private TestJwtSupport() {}

    public static String validToken(String username, String role) {
        return build(username, role, TEST_SECRET, System.currentTimeMillis() + 60_000);
    }

    public static String expiredToken(String username, String role) {
        return build(username, role, TEST_SECRET, System.currentTimeMillis() - 60_000);
    }

    public static String wrongSignatureToken(String username, String role) {
        return build(username, role, WRONG_SECRET, System.currentTimeMillis() + 60_000);
    }

    public static String tamperedToken(String username, String role) {
        String token = validToken(username, role);
        // Flip the last character of the signature segment to corrupt it.
        int lastDot = token.lastIndexOf('.');
        char last = token.charAt(token.length() - 1);
        char replacement = last == 'A' ? 'B' : 'A';
        return token.substring(0, token.length() - 1) + replacement;
    }

    private static String build(String username, String role, String secretB64, long expiryMillis) {
        SecretKey key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secretB64));
        return Jwts.builder()
                .subject(username)
                .claim("role", role)
                .issuedAt(new Date())
                .expiration(new Date(expiryMillis))
                .signWith(key)
                .compact();
    }
}
