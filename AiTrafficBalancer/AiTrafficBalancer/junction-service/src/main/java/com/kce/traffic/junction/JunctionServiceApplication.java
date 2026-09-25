package com.kce.traffic.junction;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@SpringBootApplication
@EnableDiscoveryClient
public class JunctionServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(JunctionServiceApplication.class, args);
    }
}
