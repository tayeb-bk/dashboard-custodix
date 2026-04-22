package com.example.custodix.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Getter
@Setter
@NoArgsConstructor
public class PythonSqlResponseDTO {

    @JsonProperty("sql_query")
    private String sqlQuery;
}
