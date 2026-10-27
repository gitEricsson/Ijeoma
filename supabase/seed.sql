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

insert into site_state (id, status, count_home) values (1, 'on_the_road', true) on conflict (id) do nothing;

insert into admins (email) values ('ericssonraphael@gmail.com') on conflict do nothing;

-- First sponsor, on the bonnet.
insert into sponsors (name, panel, tier, link, active)
select 'JEFFFOREX', 'bonnet', 'First sponsor', 'https://www.instagram.com/jeffforex_/', true
where not exists (select 1 from sponsors where name = 'JEFFFOREX' and deleted_at is null);
update sponsors set logo_url = '/sponsors/jeffforex.webp' where name = 'JEFFFOREX' and logo_url is null;

-- Stickers re-placed from the photos (Oct 9 2026): move rows from their old spots.
update sponsors set panel = 'right front wing' where name = 'C9X' and panel = 'left rear door corner';
update sponsors set panel = 'right rear door glass' where name = 'Ralph Custom' and panel = 'right front window';
update sponsors set panel = 'rear left corner' where name = 'Solsync' and panel = 'tailgate';
update sponsors set panel = 'left front door', active = true where name = 'Project Africa 54' and panel = 'roof';

-- The stickers on IJEOMA, where they are on the real car (logos in public/sponsors).
-- `panel` is a sticker spot (SPOTS in lib/site.ts).
insert into sponsors (name, panel, tier, link, logo_url, active)
select v.name, v.panel, v.tier, v.link, v.logo_url, v.active
from (values
  ('JEFFFOREX', 'right front door handle', 'First sponsor', 'https://www.instagram.com/jeffforex_/', '/sponsors/jeffforex.webp', true),
  ('Ralph Custom', 'right rear door glass', 'partner', 'https://www.instagram.com/ralph_custom/', '/sponsors/ralph-custom.webp', true),
  ('City Jollof', 'left rear window', 'partner', 'https://www.instagram.com/city_jollof/', '/sponsors/city-jollof.webp', true),
  ('C9X', 'right front wing', 'partner', 'https://www.instagram.com/c9x.ng/', '/sponsors/c9x.webp', true),
  ('NYNTH WORLD', 'left C-pillar', 'partner', 'https://www.instagram.com/nynthworld/', '/sponsors/nynth-world.webp', true),
  ('Solsync', 'right rear quarter glass', 'partner', 'https://www.instagram.com/the_solsync/', '/sponsors/solsync.webp', true),
  ('Solsync', 'rear left corner', 'partner', 'https://www.instagram.com/the_solsync/', '/sponsors/solsync.webp', true),
  ('Wraphaus', 'rear window', 'partner', 'https://www.instagram.com/wraphaus.ng/', '/sponsors/wraphaus.webp', true),
  ('Project Africa 54', 'left front door', 'partner', 'https://www.instagram.com/projectafrica54/', '/sponsors/projectafrica54.webp', true)
) as v (name, panel, tier, link, logo_url, active)
where not exists (select 1 from sponsors s where s.name = v.name and s.panel = v.panel and s.deleted_at is null);

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

-- The real trip, as reconstructed from Michael's posts (8 Oct 2026): the
-- send-off at Humble Autos, Lekki on 4 October, then into Benin.
insert into expeditions (id, name, start_date, end_date, summary, is_placeholder)
values ('00000000-0000-4000-8000-000000000002', 'Project Africa 54: West Africa', '2026-10-04', null,
        'Set off from Lagos on 4 October 2026, into Benin, country number 1.', false)
on conflict (id) do nothing;

insert into stops (id, expedition_id, city, country_iso2, lat, lng, arrived_on, left_on, arrival_mode, caption, is_reconstructed) values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000002', 'Lagos',   'NG', 6.4485, 3.4552, '2026-10-04', '2026-10-04', 'drive', 'Farewell send-off at Humble Autos, Lekki Phase 1', true),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000002', 'Cotonou', 'BJ', 6.37146, 2.40979, '2026-10-05', null, 'drive', 'Étoile Rouge', true),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000002', 'Porto-Novo', 'BJ', 6.499, 2.625, '2026-10-11', null, 'drive', 'By the statue in Porto-Novo', true),
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000002', 'Agblangandan', 'BJ', 6.378, 2.487, '2026-10-14', null, 'drive', 'Pekadis', true),
  ('00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000002', 'Gbodjomé', 'TG', 6.1945, 1.4164, '2026-10-17', null, 'drive', 'Thumbs up on the coast road', true),
  ('00000000-0000-4000-8000-000000000206', '00000000-0000-4000-8000-000000000002', 'Nyamassila', 'TG', 7.9882, 1.1922, '2026-10-22', null, 'drive', 'Roadside stop on the way north', true),
  ('00000000-0000-4000-8000-000000000207', '00000000-0000-4000-8000-000000000002', 'Kpalimé', 'TG', 6.9107, 0.6324, '2026-10-23', null, 'drive', 'Off the tarmac in the hills outside Kpalimé', true),
  ('00000000-0000-4000-8000-000000000208', '00000000-0000-4000-8000-000000000002', 'Dapaong', 'TG', 10.8623, 0.2076, '2026-10-25', null, 'drive', 'Arms wide on the bonnet in Dapaong', true),
  ('00000000-0000-4000-8000-000000000209', '00000000-0000-4000-8000-000000000002', 'Tenkodogo', 'BF', 11.7800, -0.3697, '2026-10-27', null, 'drive', 'Up on the roof rack in Tenkodogo', true)
on conflict (id) do nothing;

-- Checkpoint pictures: Michael with IJEOMA by Étoile Rouge (Cotonou), by the
-- statue (Porto-Novo, Sunday 11 Oct), bonnet up at Pekadis (Wednesday 14 Oct),
-- then into Togo: Gbodjomé on the coast road (17 Oct), Nyamassila (22 Oct),
-- back south to the hills outside Kpalimé (23 Oct), up to Dapaong (25 Oct) and
-- over the border to Tenkodogo, Burkina Faso (27 Oct). Only Gbodjomé and
-- Kpalimé have firm dates; the rest are fitted around them.
update stops set photo_url = '/photos/stops/cotonou-etoile-rouge.jpg'
where id = '00000000-0000-4000-8000-000000000202' and photo_url is null;
update stops set photo_url = '/photos/stops/porto-novo-statue.jpg'
where id = '00000000-0000-4000-8000-000000000203' and photo_url is null;
update stops set photo_url = '/photos/stops/agblangandan-pekadis.jpg'
where id = '00000000-0000-4000-8000-000000000204' and photo_url is null;
update stops set photo_url = '/photos/stops/gbodjome-coast-road.jpg'
where id = '00000000-0000-4000-8000-000000000205' and photo_url is null;
update stops set photo_url = '/photos/stops/nyamassila-roadside.jpg'
where id = '00000000-0000-4000-8000-000000000206' and photo_url is null;
update stops set photo_url = '/photos/stops/kpalime-hills-track.jpg'
where id = '00000000-0000-4000-8000-000000000207' and photo_url is null;
update stops set photo_url = '/photos/stops/dapaong-on-the-bonnet.jpg'
where id = '00000000-0000-4000-8000-000000000208' and photo_url is null;
update stops set photo_url = '/photos/stops/tenkodogo-roof-rack.jpg'
where id = '00000000-0000-4000-8000-000000000209' and photo_url is null;

-- Country pictures for the trail preview: frames from his story highlights
-- (Ghana, Togo, Benin) and a reel photo of IJEOMA in Lagos (Nigeria).
update countries set photo_url = '/photos/countries/' || lower(iso2) || '.jpg'
where iso2 in ('NG', 'GH', 'TG', 'BJ') and photo_url is null;

select refresh_country_status();
