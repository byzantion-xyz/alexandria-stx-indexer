export interface runScraperData {
    contract_key: string,
    token_id?: number,
    starting_token_id?: number,
    ending_token_id?: number,
    override_frozen?: boolean,
    force_scrape?: boolean
}