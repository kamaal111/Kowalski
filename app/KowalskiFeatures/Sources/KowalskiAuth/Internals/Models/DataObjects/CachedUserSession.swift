//
//  CachedUserSession.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 4/5/26.
//

import Foundation

struct CachedUserSession: Codable {
    let session: UserSession
    let cachedAt: Date
}
