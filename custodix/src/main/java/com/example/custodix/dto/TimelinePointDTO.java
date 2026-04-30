package com.example.custodix.dto;

import java.time.LocalDateTime;

public record TimelinePointDTO(LocalDateTime bucket, Long total, String category) {
    public TimelinePointDTO(LocalDateTime bucket, Long total) {
        this(bucket, total, null);
    }
}