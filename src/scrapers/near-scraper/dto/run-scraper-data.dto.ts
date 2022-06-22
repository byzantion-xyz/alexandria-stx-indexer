export interface runScraperData {
    contract_key?: string,
    token_series_id?: string,
    token_id?: number,
    starting_token_id?: number,
    ending_token_id?: number,
    scrape_from_paras_api?: boolean,
    override_frozen?: boolean,
    force_scrape?: boolean
}