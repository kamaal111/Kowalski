//
//  KowalskiAuthErrors.swift
//  KowalskiClient
//

import OpenAPIRuntime

public enum KowalskiAuthSessionErrors: Error {
    case unknown(statusCode: Int, payload: OpenAPIRuntime.UndocumentedPayload?, context: Error?)
    case unauthorized
}

public enum KowalskiAuthPreferencesErrors: Error {
    case unknown(statusCode: Int, payload: OpenAPIRuntime.UndocumentedPayload?, context: Error?)
    case unauthorized
    case badRequest
}
