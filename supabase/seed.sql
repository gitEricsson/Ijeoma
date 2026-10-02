-- Seed data. Safe to re-run: every insert is idempotent.

-- All 54 African countries. Centroids are Natural Earth label points.
insert into countries (iso2, name, centroid_lng, centroid_lat, ig_highlight_url, is_home) values
  ('DZ', 'Algeria', 2.8082, 27.3974, null, false),
  ('AO', 'Angola', 17.9842, -12.1828, null, false),
  ('BJ', 'Benin', 2.3520, 10.3248, 'https://www.instagram.com/stories/highlights/18105359102031479/', false),
  ('BW', 'Botswana', 24.1792, -22.1026, null, false),
  ('BF', 'Burkina Faso', -1.3639, 12.6730, null, false),
  ('BI', 'Burundi', 29.9171, -3.3328, null, false),
  ('CM', 'Cameroon', 12.4735, 4.5850, null, false),
  ('CF', 'Central African Republic', 20.9069, 6.9897, null, false),
  ('TD', 'Chad', 18.6450, 15.1430, null, false),
  ('KM', 'Comoros', 43.3181, -11.7277, null, false),
  ('CI', 'Côte d''Ivoire', -5.5686, 7.4914, null, false),
  ('DJ', 'Djibouti', 42.4988, 11.9763, null, false),
  ('CD', 'DR Congo', 23.4588, -1.8582, null, false),
  ('EG', 'Egypt', 29.4458, 26.1862, null, false),
  ('GQ', 'Equatorial Guinea', 8.9902, 2.3330, null, false),
  ('ER', 'Eritrea', 38.2856, 15.7874, null, false),
  ('SZ', 'Eswatini', 31.4673, -26.5337, null, false),
  ('ET', 'Ethiopia', 39.0886, 8.0328, null, false),
  ('GA', 'Gabon', 11.8359, -0.4377, null, false),
  ('GH', 'Ghana', -1.0369, 7.7176, 'https://www.instagram.com/stories/highlights/18116390494907198/', false),
  ('GN', 'Guinea', -10.0164, 10.6185, null, false),
  ('GW', 'Guinea-Bissau', -14.5241, 12.1637, null, false),
  ('KE', 'Kenya', 37.9076, 0.5490, null, false),
  ('LS', 'Lesotho', 28.2466, -29.4802, null, false),
  ('LR', 'Liberia', -9.4604, 6.4472, null, false),
  ('LY', 'Libya', 18.0110, 26.6389, null, false),
  ('MG', 'Madagascar', 46.7042, -18.6283, null, false),
  ('MW', 'Malawi', 33.6081, -13.3867, null, false),
  ('ML', 'Mali', -2.0385, 18.6927, null, false),
  ('MR', 'Mauritania', -9.7403, 19.5871, null, false),
  ('MU', 'Mauritius', 57.5658, -20.2995, null, false),
  ('MA', 'Morocco', -7.1873, 31.6507, null, false),
  ('MZ', 'Mozambique', 37.8379, -13.9432, null, false),
  ('NA', 'Namibia', 17.1082, -20.5753, null, false),
  ('NE', 'Niger', 9.5044, 17.4462, null, false),
  ('NG', 'Nigeria', 7.5032, 9.4398, 'https://www.instagram.com/stories/highlights/18108778124040479/', true),
  ('CV', 'Republic of Cabo Verde', -23.6394, 15.0748, null, false),
  ('CG', 'Republic of the Congo', 15.9005, 0.1423, null, false),
  ('RW', 'Rwanda', 30.1039, -1.8972, null, false),
  ('ST', 'São Tomé and Príncipe', 7.0210, 0.9709, null, false),
  ('SN', 'Senegal', -14.7786, 15.1381, null, false),
  ('SC', 'Seychelles', 55.4802, -4.6767, null, false),
  ('SL', 'Sierra Leone', -11.7637, 8.6174, null, false),
  ('SO', 'Somalia', 45.1924, 3.5689, null, false),
  ('ZA', 'South Africa', 23.6657, -29.7088, null, false),
  ('SS', 'South Sudan', 30.3902, 7.2305, null, false),
  ('SD', 'Sudan', 29.2607, 16.3307, null, false),
  ('TZ', 'Tanzania', 34.9592, -6.0519, null, false),
  ('GM', 'The Gambia', -14.9983, 13.6417, null, false),
  ('TG', 'Togo', 1.0581, 8.8072, 'https://www.instagram.com/stories/highlights/18362338498240129/', false),
  ('TN', 'Tunisia', 9.0079, 33.6873, null, false),
  ('UG', 'Uganda', 32.9486, 1.9726, null, false),
  ('ZM', 'Zambia', 26.3953, -14.6608, null, false),
  ('ZW', 'Zimbabwe', 29.9254, -18.9116, null, false)
on conflict (iso2) do update set
  name = excluded.name,
  centroid_lng = excluded.centroid_lng,
  centroid_lat = excluded.centroid_lat,
  ig_highlight_url = coalesce(countries.ig_highlight_url, excluded.ig_highlight_url),
  is_home = excluded.is_home;

insert into site_state (id, status) values (1, 'at_base') on conflict (id) do nothing;

insert into admins (email) values ('ericssonraphael@gmail.com') on conflict do nothing;

-- First sponsor, on the bonnet.
insert into sponsors (name, panel, tier, link, active)
select 'JEFFFOREX', 'bonnet', 'First sponsor', 'https://www.instagram.com/jeffforex_/', true
where not exists (select 1 from sponsors where name = 'JEFFFOREX' and deleted_at is null);

-- Public reels from @michaelspyder (and collabs) as of Oct 1 2026: buying and
-- prepping IJEOMA. No stop attached, so they show as "From the road".
insert into posts (url, shortcode, kind, author, posted_on, caption, sort) values
  ('https://www.instagram.com/michaelspyder/reel/DdHQf2lRlVb/', 'DdHQf2lRlVb', 'reel', 'michaelspyder', '2026-09-10', 'I bought a new car for $20,000', 0),
  ('https://www.instagram.com/michaelspyder/reel/DdRmZ1LCAki/', 'DdRmZ1LCAki', 'reel', 'michaelspyder', '2026-09-14', null, 1),
  ('https://www.instagram.com/michaelspyder/reel/Ddb85i-RY4a/', 'Ddb85i-RY4a', 'reel', 'michaelspyder', '2026-09-18', 'Day 2 of modifying IJEOMA', 2),
  ('https://www.instagram.com/michaelspyder/reel/Ddebl4FCMkW/', 'Ddebl4FCMkW', 'reel', 'michaelspyder', '2026-09-19', null, 3),
  ('https://www.instagram.com/michaelspyder/reel/Ddg95briHyo/', 'Ddg95briHyo', 'reel', 'michaelspyder', '2026-09-20', 'I think I made a huge mistake', 4),
  ('https://www.instagram.com/michaelspyder/reel/DdjU5SQiuKg/', 'DdjU5SQiuKg', 'reel', 'michaelspyder', '2026-09-21', null, 5),
  ('https://www.instagram.com/michaelspyder/reel/Ddo-qm1xqEr/', 'Ddo-qm1xqEr', 'reel', 'michaelspyder', '2026-09-23', null, 6),
  ('https://www.instagram.com/michaelspyder/reel/DdvvyvcxTkk/', 'DdvvyvcxTkk', 'reel', 'michaelspyder', '2026-09-26', null, 7),
  ('https://www.instagram.com/_ola_of_lagos_/reel/Dd1odB4OXtw/', 'Dd1odB4OXtw', 'reel', '_ola_of_lagos_', '2026-09-28', 'Ola of Lagos gives Spyder', 8),
  ('https://www.instagram.com/michaelspyder/reel/Dd3oVtORHVe/', 'Dd3oVtORHVe', 'reel', 'michaelspyder', '2026-09-29', null, 9),
  ('https://www.instagram.com/abayomi_alvin/reel/Dd8hUR6s__P/', 'Dd8hUR6s__P', 'reel', 'abayomi_alvin', '2026-10-01', null, 10),
  ('https://www.instagram.com/michaelspyder/reel/Dd8xvhJxd__/', 'Dd8xvhJxd__', 'reel', 'michaelspyder', '2026-10-01', null, 11)
on conflict (shortcode) where deleted_at is null do nothing;

-- PLACEHOLDER history for the Ghana / Togo / Benin trip. The cities follow
-- the coast road but the dates are NOT real: replace these with Spyder's
-- actual stops in the admin page, then delete this expedition.
-- is_placeholder keeps its dates out of the "days on the road" stat.
insert into expeditions (id, name, start_date, end_date, summary, is_placeholder)
values ('00000000-0000-4000-8000-000000000001', 'West Africa coast (placeholder)', '2026-06-01', '2026-06-14',
        'Placeholder route through Benin, Togo and Ghana. Replace with the real stops.', true)
on conflict (id) do nothing;

insert into stops (id, expedition_id, city, country_iso2, lat, lng, arrived_on, left_on, arrival_mode, caption, is_reconstructed) values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'Lagos',   'NG', 6.4550, 3.3841, '2026-06-01', '2026-06-01', 'drive', 'Home base', true),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'Cotonou', 'BJ', 6.3654, 2.4183, '2026-06-02', '2026-06-04', 'drive', null, true),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 'Lomé',    'TG', 6.1319, 1.2228, '2026-06-05', '2026-06-07', 'drive', null, true),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001', 'Accra',   'GH', 5.6037, -0.1870, '2026-06-08', '2026-06-12', 'drive', null, true),
  ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001', 'Lagos',   'NG', 6.4550, 3.3841, '2026-06-14', null, 'drive', 'Back home', true)
on conflict (id) do nothing;

-- Country pictures for the trail preview: frames from his story highlights
-- (Ghana, Togo, Benin) and a reel photo of IJEOMA in Lagos (Nigeria).
update countries set photo_url = '/photos/countries/' || lower(iso2) || '.jpg'
where iso2 in ('NG', 'GH', 'TG', 'BJ') and photo_url is null;

select refresh_country_status();
