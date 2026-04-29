package com.example.custodix.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

public class FlowFileInDTO {

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class Summary {
        private long totalFiles;
        private long totalDuplicates;
        private double duplicateRate;
        private long totalManual;
        private long distinctWorkflows;
        private long distinctContracts;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class HeatmapCell {
        private int dayOfWeek;  // 1=Mon ... 7=Sun
        private int hourOfDay;  // 0-23
        private long total;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class NameCount {
        private String name;
        private long total;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class ContractStats {
        private String contrat;
        private long total;
        private long duplicates;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class AnomalyPoint {
        private LocalDateTime bucket;
        private long total;
        private long doublons;
        private long manuels;
    }
}
