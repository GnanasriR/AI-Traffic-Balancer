package com.kce.traffic.gateway.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Component
public class JwtAuthenticationFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    private static final List<String> PUBLIC_PATH_PREFIXES = List.of(
            "/api/v1/auth/",
            "/fallback/",
            "/actuator/health",
            "/actuator/info",
            "/ws/traffic",
            "/api/snapshot",
            "/api/status",
            "/api/control/",
            "/api/analytics",
            "/api/v1/analytics",
            "/api/incidents",
            "/api/v1/incidents",
            "/api/optimizer",
            "/api/v1/optimizer"
    );

    private final SecretKey signingKey;
    private final String gatewayInternalSecret;

    public JwtAuthenticationFilter(
            @Value("${jwt.secret:dHJhZmZpYy1zZWNyZXQta2V5LTMyei1ieXRlcy1taW5pbXVtLXNlY3VyZQ==}") String jwtSecret,
            @Value("${gateway.internal-secret:TrafficInternalSecretKey2026SecureGatewayToken}") String gatewayInternalSecret) {

        this.signingKey = io.jsonwebtoken.security.Keys.hmacShaKeyFor(
                io.jsonwebtoken.io.Decoders.BASE64.decode(jwtSecret));
        this.gatewayInternalSecret = gatewayInternalSecret;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();

        if (exchange.getRequest().getMethod() != null && "OPTIONS".equalsIgnoreCase(exchange.getRequest().getMethod().name())) {
            return chain.filter(exchange);
        }

        if (isPublic(path)) {
            return chain.filter(exchange);
        }

        String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return reject(exchange, "Missing or malformed Authorization header.");
        }

        String token = authHeader.substring("Bearer ".length());
        String userId;
        String role;
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            userId = claims.getSubject();
            role = claims.get("role", String.class);
            if (userId == null || userId.isBlank()) {
                return reject(exchange, "Token is missing a subject.");
            }
            if (role == null || role.isBlank()) {
                role = "USER";
            }
        } catch (Exception ex) {
            log.debug("Token rejected for {}: {}", path, ex.getMessage());
            return reject(exchange, "Invalid or expired token.");
        }

        final String finalUserId = userId;
        final String finalRole = role;

        ServerHttpRequest mutatedRequest = exchange.getRequest().mutate()
                .headers(headers -> {
                    headers.remove("X-User-Id");
                    headers.remove("X-User-Role");
                    headers.remove("X-Gateway-Secret");
                    headers.set("X-User-Id", finalUserId);
                    headers.set("X-User-Role", finalRole);
                    headers.set("X-Gateway-Secret", gatewayInternalSecret);
                })
                .build();

        return chain.filter(exchange.mutate().request(mutatedRequest).build());
    }

    private boolean isPublic(String path) {
        return PUBLIC_PATH_PREFIXES.stream().anyMatch(path::startsWith);
    }

    private Mono<Void> reject(ServerWebExchange exchange, String message) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        response.getHeaders().add(HttpHeaders.CONTENT_TYPE, "application/json");
        String body = "{\"status\":401,\"error\":\"Unauthorized\",\"message\":\"" + message + "\"}";
        DataBuffer buffer = response.bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8));
        return response.writeWith(Mono.just(buffer));
    }

    @Override
    public int getOrder() {
        return -1;
    }
}