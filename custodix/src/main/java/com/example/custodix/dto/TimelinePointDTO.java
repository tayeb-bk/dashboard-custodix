package com.example.custodix.dto;

import java.time.LocalDateTime;

public record TimelinePointDTO(LocalDateTime bucket, Long total) {}