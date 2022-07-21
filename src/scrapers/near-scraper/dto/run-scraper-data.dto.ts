export interface runScraperData {
    slug?: string,
    contract_key?: string,
    token_series_id?: string,
    token_id?: number,
    starting_token_id?: number,
    ending_token_id?: number,
    scrape_non_custodial_from_paras?: boolean,
    pin_multiple_images?: boolean,
    force_scrape?: boolean,
    override_metadata?: boolean
}