//
//  Money.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 11/9/25.
//

import KowalskiModels

struct Money: Codable, Hashable {
    let currency: KowalskiCurrency
    let value: Double
}
